
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
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { v4 as uuidv4 } from 'uuid';

type Participant = {
  id: string;
  name: string;
  stream: MediaStream | null;
  isScreenSharing: boolean;
  muted: boolean;
};

export default function MeetPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const params = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [userName, setUserName] = useState('You');
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const localUserIdRef = useRef(uuidv4());
  
  const id = params.id as string;
  
  useEffect(() => {
    const name = searchParams.get('name');
    if (name) {
      setUserName(name);
    }
  }, [searchParams]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const getMedia = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
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
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
  }, [toast]);

  useEffect(() => {
    if (!id || !userName || !hasPermission) return;

    const meetingRef = ref(database, `meetings/${id}`);
    const participantRef = ref(database, `meetings/${id}/participants/${localUserIdRef.current}`);
    
    const presenceRef = ref(database, '.info/connected');

    onValue(presenceRef, (snap) => {
        if (snap.val() === true) {
            set(participantRef, {
                name: userName,
                joinedAt: serverTimestamp(),
            });

            onDisconnect(participantRef).remove();
        }
    });

    onValue(ref(database, `meetings/${id}/participants`), (snapshot) => {
        const otherParticipants = snapshot.val() || {};
        const newParticipants: Participant[] = [];
        for (const participantId in otherParticipants) {
            if (participantId !== localUserIdRef.current) {
                newParticipants.push({
                    id: participantId,
                    name: otherParticipants[participantId].name,
                    stream: null, // We'll handle streams in the next step
                    isScreenSharing: false,
                    muted: false,
                })
            }
        }
        setParticipants(newParticipants);
    });

  }, [id, userName, hasPermission]);


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
            {localStream ? (
                <VideoParticipant participant={{ id: localUserIdRef.current, name: userName, stream: localStream, isScreenSharing: false, muted: true }} isLarge={participants.length === 0} />
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
                    <p className="text-muted-foreground">Requesting permissions...</p>
                  )}
                </div>
            )}
            {participants.map(p => (
                <VideoParticipant key={p.id} participant={p} />
            ))}
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
