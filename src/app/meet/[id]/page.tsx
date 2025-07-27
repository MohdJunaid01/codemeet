
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
import { ref, onValue, onDisconnect, set, serverTimestamp, get, onChildAdded, onChildRemoved, push, child, remove } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import Peer from 'simple-peer';

type Participant = {
  id: string;
  name: string;
  stream?: MediaStream;
  isScreenSharing: boolean;
  muted: boolean;
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
  const peersRef = useRef<{[key: string]: Peer.Instance}>({});
  const meetingId = params.id as string;
  
  useEffect(() => {
    const name = searchParams.get('name');
    if (name) {
      setUserName(name);
    }
  }, [searchParams]);

  const cleanup = useCallback(() => {
    console.log("Cleaning up...");
    localStream?.getTracks().forEach(track => track.stop());
    const localId = localUserIdRef.current;
    if (meetingId && localId) {
        remove(ref(database, `meetings/${meetingId}/participants/${localId}`));
        remove(ref(database, `meetings/${meetingId}/signals/${localId}`));
    }
    Object.values(peersRef.current).forEach(peer => peer.destroy());
    peersRef.current = {};
    setParticipants([]);
}, [localStream, meetingId]);

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

    // Add cleanup listener for when the window is closed or reloaded
    window.addEventListener('beforeunload', cleanup);
    return () => {
        cleanup();
        window.removeEventListener('beforeunload', cleanup);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPeer = (targetId: string, initiator: boolean, stream: MediaStream): Peer.Instance => {
    const peer = new Peer({
        initiator,
        trickle: false, // Simplifies signaling
        stream,
    });

    peer.on('signal', (signalData) => {
        // Send signal to the target participant
        const signalRef = ref(database, `meetings/${meetingId}/signals/${targetId}/${localUserIdRef.current}`);
        set(signalRef, JSON.stringify(signalData));
    });

    peer.on('stream', (remoteStream) => {
        console.log('Received stream from', targetId);
        setParticipants(prev =>
            prev.map(p => (p.id === targetId ? { ...p, stream: remoteStream } : p))
        );
    });
    
    peer.on('close', () => {
        console.log(`Connection closed with ${targetId}`);
        peersRef.current[targetId]?.destroy();
        delete peersRef.current[targetId];
        setParticipants(prev => prev.filter(p => p.id !== targetId));
    });

    peer.on('error', (err) => {
        console.error(`Error with peer ${targetId}:`, err);
    });

    return peer;
  };

  useEffect(() => {
    if (!meetingId || !userName || !localStream) return;

    const localId = localUserIdRef.current;
    const participantsRef = ref(database, `meetings/${meetingId}/participants`);
    const localParticipantRef = child(participantsRef, localId);
    const signalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);

    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            set(localParticipantRef, { name: userName, joinedAt: serverTimestamp() });
            onDisconnect(localParticipantRef).remove();
            onDisconnect(ref(database, `meetings/${meetingId}/signals/${localId}`)).remove();
        }
    });

    // Listen for new participants
    onChildAdded(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        const participantData = snapshot.val();
        if (!participantId || participantId === localId) return;

        console.log(`New participant joined: ${participantData.name}`);
        setParticipants(prev => [...prev.filter(p => p.id !== participantId), { id: participantId, name: participantData.name, isScreenSharing: false, muted: false }]);
        
        const peer = createPeer(participantId, true, localStream);
        peersRef.current[participantId] = peer;
    });

    // Listen for signals intended for the local user
    onChildAdded(signalsRef, (snapshot) => {
        const senderId = snapshot.key;
        if (!senderId || senderId === localId) return;

        console.log(`Received signal from ${senderId}`);
        const peer = peersRef.current[senderId] || createPeer(senderId, false, localStream);
        
        if (peer.destroyed) {
            console.log("Cannot signal a destroyed peer");
            return;
        }
        
        try {
            const signal = JSON.parse(snapshot.val());
            peer.signal(signal);
            peersRef.current[senderId] = peer;
            // Clean up signal after processing
            remove(snapshot.ref);
        } catch (e) {
            console.error("Failed to parse signal:", e);
        }
    });

    // Listen for participants leaving
    onChildRemoved(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        if (!participantId || participantId === localId) return;
        
        console.log(`Participant left: ${snapshot.val()?.name}`);
        if(peersRef.current[participantId]) {
            peersRef.current[participantId].destroy();
            delete peersRef.current[participantId];
        }
        setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    return () => {
        Object.values(peersRef.current).forEach(peer => peer.destroy());
        peersRef.current = {};
        remove(localParticipantRef);
        remove(signalsRef);
    }
  }, [meetingId, userName, localStream, toast]);


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Meeting ID: {meetingId}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {localStream && (
                <VideoParticipant participant={{ id: localUserIdRef.current, name: userName, stream: localStream, isScreenSharing: false, muted: true }} isLarge={participants.length === 0} />
            )}
             {participants.map(p => (
                <VideoParticipant key={p.id} participant={p} />
            ))}
            {!localStream && (
                <div className="w-full h-full bg-card rounded-lg flex items-center justify-center col-span-full">
                  {!hasPermission ? (
                      <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                  ): (
                    <p className="text-muted-foreground">Requesting permissions...</p>
                  )}
                </div>
            )}
          </div>
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
