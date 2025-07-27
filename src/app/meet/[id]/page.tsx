
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
    console.log("Running cleanup for user:", localUserIdRef.current);
    const localId = localUserIdRef.current;
    
    // Stop local media tracks
    localStream?.getTracks().forEach(track => track.stop());

    // Destroy all peer connections
    Object.values(peersRef.current).forEach(peer => {
        if (!peer.destroyed) {
            peer.destroy();
        }
    });
    peersRef.current = {};

    // Remove user from database
    if (meetingId && localId) {
        const localParticipantRef = ref(database, `meetings/${meetingId}/participants/${localId}`);
        remove(localParticipantRef);
        const localSignalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
        remove(localSignalsRef);
    }
    
    setParticipants([]);
    setLocalStream(null);
  }, [localStream, meetingId]);

  // Request media access and set up cleanup
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


  // Main WebRTC and Firebase Logic
  useEffect(() => {
    if (!localStream || !meetingId || !userName) return;

    const localId = localUserIdRef.current;
    const participantsRef = ref(database, `meetings/${meetingId}/participants`);
    const localParticipantRef = ref(database, `meetings/${meetingId}/participants/${localId}`);
    
    // Set up presence and automatic disconnect
    onValue(ref(database, '.info/connected'), (snap) => {
        if (snap.val() === true) {
            set(localParticipantRef, { name: userName, joinedAt: serverTimestamp() });
            onDisconnect(localParticipantRef).remove();
        }
    });

    // Function to create a peer connection
    const createPeer = (targetUserId: string, initiator: boolean): Peer.Instance => {
        console.log(`Creating peer connection to ${targetUserId} as ${initiator ? 'initiator' : 'receiver'}`);
        const peer = new Peer({
            initiator,
            trickle: true,
            stream: localStream,
        });

        // Send signal data to the other peer via Firebase
        peer.on('signal', (signal) => {
            const signalsRefForTarget = ref(database, `meetings/${meetingId}/signals/${targetUserId}/${localId}`);
            set(signalsRefForTarget, JSON.stringify(signal));
        });

        // Handle incoming stream from the other peer
        peer.on('stream', (remoteStream) => {
            console.log(`Received stream from ${targetUserId}`);
            setParticipants(prev => {
                // Avoid duplicates
                if (prev.find(p => p.id === targetUserId)) {
                   return prev.map(p => (p.id === targetUserId ? { ...p, stream: remoteStream } : p));
                }
                const newParticipant = { id: targetUserId, name: '...', stream: remoteStream };

                // Fetch name for the new participant
                 const participantRef = ref(database, `meetings/${meetingId}/participants/${targetUserId}`);
                 onValue(participantRef, (snap) => {
                    if (snap.exists()){
                         setParticipants(p => p.map(participant => participant.id === targetUserId ? {...participant, name: snap.val().name} : participant));
                    }
                }, { onlyOnce: true });

                return [...prev, newParticipant];
            });
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
             if (peersRef.current[targetUserId]) {
                peersRef.current[targetUserId].destroy();
            }
        });

        return peer;
    };

    // --- Firebase Listeners ---

    // Listen for new participants joining the meeting
    const participantsListener = onChildAdded(participantsRef, (snapshot) => {
        const participantId = snapshot.key;
        const participantData = snapshot.val();
        if (!participantId || participantId === localId || peersRef.current[participantId]) {
            return;
        }

        console.log(`A new participant joined: ${participantData.name} (${participantId})`);
        
        // As the existing user, I will initiate the connection
        const peer = createPeer(participantId, true);
        peersRef.current[participantId] = peer;
        
        setParticipants(prev => {
            if (prev.find(p => p.id === participantId)) return prev;
            return [...prev, { id: participantId, name: participantData.name }];
        });
    });

    // Listen for signals intended for me
    const signalsRef = ref(database, `meetings/${meetingId}/signals/${localId}`);
    const signalsListener = onChildAdded(signalsRef, (snapshot) => {
        const senderId = snapshot.key;
        if (!senderId) return;

        const signalData = JSON.parse(snapshot.val());

        let peer = peersRef.current[senderId];
        // If I am the initiator, I will ignore signals. The other peer will create the connection.
        if (!peer) {
            console.log(`Received signal from ${senderId}, creating a receiver peer.`);
            peer = createPeer(senderId, false);
            peersRef.current[senderId] = peer;
            
            // Add participant to the list if not already there
            setParticipants(prev => {
                if (prev.find(p => p.id === senderId)) return prev;
                const participantRef = ref(database, `meetings/${meetingId}/participants/${senderId}`);
                onValue(participantRef, (snap) => {
                    if (snap.exists()){
                         setParticipants(p => {
                            if (p.find(participant => participant.id === senderId)) return p;
                            return [...p, { id: senderId, name: snap.val().name }]
                         });
                    }
                }, { onlyOnce: true });
                return prev;
            });
        }
        
        peer.signal(signalData);
        // Remove the signal after processing
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

    // Return a cleanup function for this effect
    return () => {
        console.log("Cleaning up Firebase listeners");
        participantsRef.off('child_added', participantsListener);
        participantsRef.off('child_removed', participantRemovedListener);
        signalsRef.off('child_added', signalsListener);
        const connectedRef = ref(database, '.info/connected');
        onValue(connectedRef, () => {}, { onlyOnce: true }); // Detach listener
        onDisconnect(localParticipantRef).cancel(); // Cancel disconnect operation
    }
  }, [meetingId, userName, localStream]);


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
          {allParticipants.length > 0 ? (
            <div className={`grid gap-4 w-full h-full grid-cols-1 md:grid-cols-${allParticipants.length > 1 ? '2' : '1'} lg:grid-cols-${allParticipants.length > 4 ? '3' : (allParticipants.length > 1 ? '2' : '1')}`}>
                {allParticipants.map(p => (
                    <VideoParticipant key={p.id} participant={p} />
                ))}
            </div>
          ) : (
                <div className="w-full h-full bg-card rounded-lg flex items-center justify-center col-span-full">
                  {!hasPermission ? (
                      <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                  ): (
                    <p className="text-muted-foreground">Waiting for others to join...</p>
                  )}
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

    