
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
import { ref, onValue, onDisconnect, set, serverTimestamp, onChildAdded, onChildRemoved, remove, off } from 'firebase/database';
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

  }, [toast]);


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

    // Function to create a peer connection
    const createPeer = (targetUserId: string, initiator: boolean): Peer.Instance => {
        console.log(`[${localId}] Creating peer to ${targetUserId} (initiator: ${initiator})`);
        const peer = new Peer({
            initiator,
            trickle: true,
            stream: localStream,
        });

        // Send signal data to the other peer via Firebase
        peer.on('signal', (signal) => {
            const signalRef = ref(database, `meetings/${meetingId}/signals/${targetUserId}/${localId}`);
            set(signalRef, JSON.stringify(signal));
        });

        // Handle incoming stream from the other peer
        peer.on('stream', (remoteStream) => {
            console.log(`[${localId}] Received stream from ${targetUserId}`);
            setParticipants(prev => {
                const existing = prev.find(p => p.id === targetUserId);
                if (existing) {
                   return prev.map(p => (p.id === targetUserId ? { ...p, stream: remoteStream } : p));
                }
                // This case should ideally not be hit often if participant list is managed well
                return [...prev, {id: targetUserId, name: '...', stream: remoteStream}]
            });
        });
        
        peer.on('close', () => {
            console.log(`[${localId}] Peer connection closed with ${targetUserId}`);
            if (peersRef.current[targetUserId]) {
                peersRef.current[targetUserId].destroy();
                delete peersRef.current[targetUserId];
            }
            setParticipants(prev => prev.filter(p => p.id !== targetUserId));
        });

        peer.on('error', (err) => {
            console.error(`[${localId}] Peer error with ${targetUserId}:`, err);
             if (peersRef.current[targetUserId]) {
                peersRef.current[targetUserId].destroy();
                delete peersRef.current[targetUserId];
            }
        });

        return peer;
    };

    // --- Firebase Listeners ---

    // Listen for new participants joining the meeting
    const participantsListener = onChildAdded(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        const participantData = snapshot.val();
        if (!participantId || participantId === localId) {
            return;
        }

        console.log(`[${localId}] New participant joined: ${participantData.name} (${participantId})`);
        
        const peer = createPeer(participantId, true); // I am the initiator
        peersRef.current[participantId] = peer;
        
        setParticipants(prev => {
            if (prev.find(p => p.id === participantId)) return prev;
            return [...prev, { id: participantId, name: participantData.name }];
        });
    });

    // Listen for signals intended for me
    const mySignalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
    const signalsListener = onChildAdded(mySignalsRef, (snapshot) => {
        const senderId = snapshot.key;
        if (!senderId) return;

        const signalData = JSON.parse(snapshot.val());

        let peer = peersRef.current[senderId];
        
        // If I don't have a peer for this sender, it means they are the initiator.
        if (!peer) {
            console.log(`[${localId}] Received signal from new peer ${senderId}, creating receiver peer.`);
            peer = createPeer(senderId, false); // I am the receiver
            peersRef.current[senderId] = peer;
             
            // Add participant to list if not already there, get their name
             const theirParticipantRef = ref(database, `meetings/${meetingId}/participants/${senderId}`);
             onValue(theirParticipantRef, (snap) => {
                if(snap.exists()){
                     setParticipants(prev => {
                        if (prev.find(p => p.id === senderId)) return prev;
                        return [...prev, { id: senderId, name: snap.val().name }];
                    });
                }
             }, { onlyOnce: true });

        }
        
        peer.signal(signalData);
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
        const localId = localUserIdRef.current;
        console.log(`[${localId}] Cleaning up main effect.`);
        
        const localParticipantRef = ref(database, `meetings/${meetingId}/participants/${localId}`);
        remove(localParticipantRef);
        
        const localSignalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
        remove(localSignalsRef);

        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        
        off(participantsRef, 'child_added', participantsListener);
        off(participantsRef, 'child_removed', participantRemovedListener);
        off(mySignalsRef, 'child_added', signalsListener);
        off(connectedRef, 'value', connectedListener);

        onDisconnect(localParticipantRef).cancel(); // Important to cancel on-disconnect
    }
  }, [meetingId, userName, localStream, hasPermission]);


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
                    <VideoParticipant key={p.id} participant={p} />
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
