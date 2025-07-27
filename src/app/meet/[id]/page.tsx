
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
import { ref, onValue, onDisconnect, set, serverTimestamp, onChildAdded, onChildRemoved, remove } from 'firebase/database';
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
  const peersRef = useRef<{ [key: string]: Peer.Instance }>({});
  const meetingId = params.id as string;
  
  useEffect(() => {
    const name = searchParams.get('name');
    if (name) {
      setUserName(name);
    }
  }, [searchParams]);

  const cleanup = useCallback(() => {
    console.log("Cleaning up for user:", localUserIdRef.current);
    localStream?.getTracks().forEach(track => track.stop());
    const localId = localUserIdRef.current;
    if (meetingId && localId) {
        remove(ref(database, `meetings/${meetingId}/participants/${localId}`));
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

    window.addEventListener('beforeunload', cleanup);
    return () => {
        cleanup();
        window.removeEventListener('beforeunload', cleanup);
    };
  }, [cleanup, toast]);

  useEffect(() => {
    if (!meetingId || !userName || !localStream) return;

    const localId = localUserIdRef.current;
    const participantsRef = ref(database, `meetings/${meetingId}/participants`);
    const localParticipantRef = ref(database, `meetings/${meetingId}/participants/${localId}`);
    
    // Set up presence and disconnection logic
    const connectedRef = ref(database, '.info/connected');
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            set(localParticipantRef, { name: userName, joinedAt: serverTimestamp() });
            onDisconnect(localParticipantRef).remove();
        }
    });

    // Function to create a peer connection
    const createPeer = (targetUserId: string, initiator: boolean): Peer.Instance => {
        console.log(`Creating peer connection to ${targetUserId}, initiator: ${initiator}`);
        const peer = new Peer({
            initiator,
            trickle: false,
            stream: localStream,
        });

        peer.on('signal', (signal) => {
            console.log(`Sending signal from ${localId} to ${targetUserId}`);
            set(ref(database, `meetings/${meetingId}/signals/${targetUserId}/${localId}`), JSON.stringify(signal));
        });

        peer.on('stream', (remoteStream) => {
            console.log(`Received stream from ${targetUserId}`);
            setParticipants(prev =>
                prev.map(p => (p.id === targetUserId ? { ...p, stream: remoteStream } : p))
            );
        });

        peer.on('close', () => {
            console.log(`Peer connection closed with ${targetUserId}`);
            if (peersRef.current[targetUserId]) {
                peersRef.current[targetUserId].destroy();
                delete peersRef.current[targetUserId];
            }
            setParticipants(prev => prev.filter(p => p.id !== targetUserId));
        });

        peer.on('error', (err) => {
            console.error(`Peer error with ${targetUserId}:`, err);
        });

        return peer;
    };

    // Listen for new participants joining
    const participantsListener = onChildAdded(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        const participantData = snapshot.val();
        if (!participantId || participantId === localId || peersRef.current[participantId]) {
            return;
        }

        console.log(`New participant detected: ${participantData.name} (${participantId})`);
        setParticipants(prev => [...prev, { id: participantId, name: participantData.name, isScreenSharing: false, muted: false }]);
        
        // This user is the initiator
        const peer = createPeer(participantId, true);
        peersRef.current[participantId] = peer;
    });

    // Listen for signals intended for the local user
    const signalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
    const signalsListener = onChildAdded(signalsRef, (snapshot) => {
        const senderId = snapshot.key;
        if (!senderId) return;

        const signalData = JSON.parse(snapshot.val());
        console.log(`Received signal from ${senderId}`);

        let peer = peersRef.current[senderId];
        if (!peer) {
            console.log(`No peer for ${senderId}, creating one as non-initiator.`);
            // This user is the receiver
            peer = createPeer(senderId, false);
            peersRef.current[senderId] = peer;
        }

        if (peer.destroyed) {
            console.warn(`Cannot signal a destroyed peer for ${senderId}`);
            return;
        }

        peer.signal(signalData);
        // Remove the signal from DB after processing
        remove(snapshot.ref);
    });

    // Listen for participants leaving
    const participantRemovedListener = onChildRemoved(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        if (!participantId || participantId === localId) return;
        
        console.log(`Participant left: ${snapshot.val()?.name} (${participantId})`);
        if (peersRef.current[participantId]) {
            peersRef.current[participantId].destroy();
            delete peersRef.current[participantId];
        }
        setParticipants(prev => prev.filter(p => p.id !== participantId));
    });

    // Cleanup listeners on component unmount
    return () => {
        participantsRef.off('child_added', participantsListener);
        participantsRef.off('child_removed', participantRemovedListener);
        signalsRef.off('child_added', signalsListener);
        cleanup();
    }
  }, [meetingId, userName, localStream, cleanup]);


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
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-min">
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
