
"use client";

import { useState, useEffect, useRef } from 'react';
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";
import { ChatPanel } from "@/components/codemeet/chat-panel";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSearchParams, useParams } from 'next/navigation';
import type { Message } from '@/components/codemeet/chat-panel';
import { database } from '@/lib/firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp, get, onChildAdded, onChildRemoved, push, child } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';
import Peer from 'simple-peer';

type Participant = {
  id: string;
  name: string;
  stream: MediaStream | null;
  isScreenSharing: boolean;
  muted: boolean;
  peer?: Peer.Instance;
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
  
  const id = params.id as string;
  
  useEffect(() => {
    const name = searchParams.get('name');
    if (name) {
      setUserName(name);
    }
  }, [searchParams]);

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
  }, [toast]);

  useEffect(() => {
    if (!id || !userName || !localStream) return;

    const meetingRef = ref(database, `meetings/${id}`);
    const participantsRef = child(meetingRef, 'participants');
    const localParticipantRef = child(participantsRef, localUserIdRef.current);
    const signalsRef = child(meetingRef, 'signals');
    const localSignalsRef = child(signalsRef, localUserIdRef.current);

    const presenceRef = ref(database, '.info/connected');

    onValue(presenceRef, (snap) => {
      if (snap.val() === true) {
        set(localParticipantRef, { name: userName, joinedAt: serverTimestamp() });
        onDisconnect(localParticipantRef).remove();
        onDisconnect(child(signalsRef, localUserIdRef.current)).remove();
      }
    });

    // Listen for new participants
    onChildAdded(participantsRef, (snapshot) => {
      const participantId = snapshot.key;
      const participantData = snapshot.val();

      if (participantId === localUserIdRef.current) return;
      
      console.log(`New participant joined: ${participantData.name}`);

      const peer = new Peer({
        initiator: true, // We are initiating the connection
        trickle: false, // Use single signaling round
        stream: localStream,
      });

      peer.on('signal', (signal) => {
        // Send signal to the new participant
        const signalRef = push(child(signalsRef, participantId));
        set(signalRef, {
            senderId: localUserIdRef.current,
            signal: JSON.stringify(signal),
        });
      });

      peer.on('stream', (stream) => {
        console.log(`Receiving stream from ${participantData.name}`);
        setParticipants(prev => prev.map(p => 
            p.id === participantId ? { ...p, stream } : p
        ));
      });
      
      peer.on('close', () => {
        console.log(`Connection closed with ${participantData.name}`);
      });
      
      peer.on('error', (err) => {
        console.error(`Error with peer ${participantData.name}:`, err);
      });

      peersRef.current[participantId] = peer;
      setParticipants(prev => [...prev, { id: participantId, name: participantData.name, stream: null, isScreenSharing: false, muted: false, peer }]);
    });

    // Listen for signals intended for us
    onChildAdded(localSignalsRef, (snapshot) => {
        const { senderId, signal: receivedSignal } = snapshot.val();
        const signal = JSON.parse(receivedSignal);

        // If we are the initiator, we don't need to process our own signals
        if(peersRef.current[senderId]) {
            peersRef.current[senderId].signal(signal);
            return;
        }

        console.log(`Received signal from ${senderId}`);
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: localStream,
        });

        peer.signal(signal);

        peer.on('signal', (signal) => {
            const signalRef = push(child(signalsRef, senderId));
            set(signalRef, {
                senderId: localUserIdRef.current,
                signal: JSON.stringify(signal),
            });
        });

        peer.on('stream', (stream) => {
            console.log(`Receiving stream from ${senderId}`);
            setParticipants(prev => prev.map(p => 
                p.id === senderId ? { ...p, stream } : p
            ));
        });

        peer.on('close', () => {
          console.log(`Connection closed with ${senderId}`);
        });

        peer.on('error', (err) => {
          console.error(`Error with peer ${senderId}:`, err);
        });

        peersRef.current[senderId] = peer;
    });

    // Listen for participants leaving
    onChildRemoved(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        if (participantId === localUserIdRef.current) return;
        
        console.log(`Participant left: ${snapshot.val().name}`);
        if(peersRef.current[participantId]) {
            peersRef.current[participantId].destroy();
            delete peersRef.current[participantId];
        }
        setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    return () => {
        // Clean up on component unmount
        Object.values(peersRef.current).forEach(peer => peer.destroy());
        set(localParticipantRef, null);
        set(localSignalsRef, null);
    }

  }, [id, userName, localStream]);


  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Meeting ID: {id}
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
