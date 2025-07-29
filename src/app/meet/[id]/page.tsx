
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";
import { ChatPanel } from "@/components/codemeet/chat-panel";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSearchParams, useParams } from 'next/navigation';
import type { Message } from '@/components/codemeet/chat-panel';
import { database } from '@/lib/firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp, onChildAdded, onChildRemoved, remove, off, get } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import Peer from 'simple-peer';

type Participant = {
  id: string;
  name: string;
  stream?: MediaStream;
};

export default function MeetPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const params = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userName, setUserName] = useState('You');
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  const localUserIdRef = useRef(uuidv4());
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
  const meetingId = params.id as string;
  
  useEffect(() => {
    const name = searchParams.get('name');
    if (name) {
      setUserName(name);
    }
  }, [searchParams]);
  
  // Request media access
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        setHasPermission(true);
      } catch (error) {
        console.error('Error accessing media devices.', error);
        setHasPermission(false);
        toast({
          variant: "destructive",
          title: "Camera and Mic Access Denied",
          description: "Please enable camera and microphone permissions in your browser settings to use this app.",
        });
      }
    };
    
    getMedia();

    return () => {
        localStream?.getTracks().forEach(track => track.stop());
    }

  }, [toast, localStream]);


  // Main WebRTC and Firebase Logic
  useEffect(() => {
    if (!localStream || !meetingId || !userName || !hasPermission) return;

    const localId = localUserIdRef.current;
    const participantsRef = ref(database, `meetings/${meetingId}/participants`);
    const localParticipantRef = ref(database, `meetings/${meetingId}/participants/${localId}`);
    
    // Set up presence and automatic disconnect
    const connectedRef = ref(database, '.info/connected');
    
    const connectedListener = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            set(localParticipantRef, { name: userName, joinedAt: serverTimestamp() });
            onDisconnect(localParticipantRef).remove();
        }
    });

    const setupPeer = (targetId: string, name: string, initiator: boolean) => {
      if (peersRef.current[targetId]) {
        console.log(`[${localId}] Peer already exists for ${targetId}`);
        return;
      }
      console.log(`[${localId}] Setting up peer to ${targetId} (${name}), initiator: ${initiator}`);

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: localStream,
      });

      peer.on('signal', (signal) => {
        const signalRef = ref(database, `meetings/${meetingId}/signals/${targetId}/${localId}`);
        set(signalRef, JSON.stringify(signal));
      });

      peer.on('stream', (remoteStream) => {
        console.log(`[${localId}] Received stream from ${targetId}`);
        setParticipants(prev =>
          prev.map(p => (p.id === targetId ? { ...p, stream: remoteStream } : p))
        );
      });

      peer.on('close', () => {
        console.log(`[${localId}] Peer connection closed with ${targetId}`);
        if (peersRef.current[targetId]) {
          peersRef.current[targetId].destroy();
          delete peersRef.current[targetId];
        }
        setParticipants(prev => prev.filter(p => p.id !== targetId));
      });

      peer.on('error', (err) => {
        console.error(`[${localId}] Peer error with ${targetId}:`, err);
        if (peersRef.current[targetId]) {
            peersRef.current[targetId].destroy();
            delete peersRef.current[targetId];
        }
         setParticipants(prev => prev.filter(p => p.id !== targetId));
      });
      
      peersRef.current[targetId] = peer;
    };


    // Listen for new participants and connect to them
    const participantsListener = onChildAdded(participantsRef, (snapshot) => {
      const participantId = snapshot.key;
      const participantData = snapshot.val();
      if (!participantId || participantId === localId || peersRef.current[participantId]) {
          return;
      }
      console.log(`[${localId}] New participant detected: ${participantData.name} (${participantId})`);
      setParticipants(prev => {
        if (prev.some(p => p.id === participantId)) return prev;
        return [...prev, { id: participantId, name: participantData.name }];
      });
      setupPeer(participantId, participantData.name, true); // I am the initiator
    });

    // Listen for signals intended for me
    const mySignalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
    const signalsListener = onChildAdded(mySignalsRef, (snapshot) => {
        const senderId = snapshot.key;
        if (!senderId) return;

        const signalData = JSON.parse(snapshot.val());

        // If a peer connection doesn't exist, it means they initiated.
        if (!peersRef.current[senderId]) {
            console.log(`[${localId}] Signal received from new peer: ${senderId}`);
            get(ref(database, `meetings/${meetingId}/participants/${senderId}`)).then(participantSnap => {
              if (participantSnap.exists()) {
                 const participantData = participantSnap.val();
                 setParticipants(prev => {
                    if (prev.some(p => p.id === senderId)) return prev;
                    return [...prev, { id: senderId, name: participantData.name }];
                 });
                 setupPeer(senderId, participantData.name, false); // I am the receiver
                 peersRef.current[senderId].signal(signalData);
              }
            });
        } else {
            peersRef.current[senderId].signal(signalData);
        }
        
        // Remove the signal after processing
        remove(snapshot.ref);
    });

    // Listen for participants leaving
    const participantRemovedListener = onChildRemoved(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        if (!participantId || participantId === localId) return;
        
        console.log(`[${localId}] Participant left: ${snapshot.val()?.name} (${participantId})`);
        if (peersRef.current[participantId]) {
            peersRef.current[participantId].destroy();
            delete peersRef.current[participantId];
        }
        setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    // --- Cleanup function for this effect ---
    return () => {
        const currentLocalId = localUserIdRef.current;
        console.log(`[${currentLocalId}] Cleaning up main effect.`);
        
        const localParticipantRefOnCleanup = ref(database, `meetings/${meetingId}/participants/${currentLocalId}`);
        remove(localParticipantRefOnCleanup);
        
        const localSignalsRefOnCleanup = ref(database, `meetings/${meetingId}/signals/${currentLocalId}`);
        remove(localSignalsRefOnCleanup);

        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        
        off(participantsRef, 'child_added', participantsListener);
        off(participantsRef, 'child_removed', participantRemovedListener);
        off(mySignalsRef, 'child_added', signalsListener);
        off(connectedRef, 'value', connectedListener);

        onDisconnect(localParticipantRefOnCleanup).cancel();
    }
  }, [meetingId, userName, localStream, hasPermission, toast]);


  const allParticipants = [
      ...(localStream ? [{ id: localUserIdRef.current, name: userName, stream: localStream }] : []),
      ...participants
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Meeting ID: {meetingId}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex items-center justify-center p-4 overflow-hidden">
          {hasPermission ? (
            <div className={`grid gap-4 w-full h-full ${allParticipants.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${allParticipants.length > 4 ? 'md:grid-cols-3' : ''}`}>
                {allParticipants.map(p => (
                    <VideoParticipant key={p.id} participant={p} isLocal={p.id === localUserIdRef.current} />
                ))}
            </div>
          ) : (
            <div className="w-full h-full bg-card rounded-lg flex items-center justify-center col-span-full">
                  <Alert variant="destructive" className="w-auto">
                    <AlertTitle>Camera Access Required</AlertTitle>
                    <AlertDescription>
                        Please allow camera access to start the meeting.
                    </AlertDescription>
                </Alert>
            </div>
          )}
        </main>
        <ChatPanel 
            isOpen={isChatOpen} 
            onClose={() => setIsChatOpen(false)}
            messages={messages}
            setMessages={setMessages}
            userName={userName}
            />
      </div>

      <footer className="py-3 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
        <ControlBar 
            localStream={localStream} 
            isChatOpen={isChatOpen}
            onChatToggle={() => setIsChatOpen(prev => !prev)}
            />
      </footer>
    </div>
  );
}

    