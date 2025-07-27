
"use client";

import { useState, useEffect, useRef } from 'react';
import { CodeEditor } from "@/components/codemeet/code-editor";
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function Home() {
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  const participants = [
    { name: 'Alex', muted: false, isScreenSharing: false, stream: null },
    { name: 'Sarah', muted: true, isScreenSharing: false, stream: null },
    { name: 'Chris', muted: false, isScreenSharing: false, stream: null },
  ];

  const screenSharer = participants.find(p => p.isScreenSharing);

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
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    }
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Project Sprint - Q3 Roadmap
        </div>
      </header>

      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="flex-1 rounded-lg overflow-hidden border border-primary shadow-lg shadow-primary/20">
            {isScreenSharing ? (
               <VideoParticipant participant={{ name: 'You', isScreenSharing: true, stream: localStream, muted: true }} isLarge />
            ) : localStream ? (
               <VideoParticipant participant={{ name: 'You', stream: localStream, isScreenSharing: false, muted: false }} isLarge />
            ) : (
               <div className="w-full h-full bg-card rounded-lg flex items-center justify-center">
                  {!hasPermission && (
                     <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                           Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                  )}
                  {hasPermission === null && (
                    <p className="text-muted-foreground">Requesting permissions...</p>
                  )}
               </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <VideoParticipant participant={{ name: 'You', stream: localStream, isScreenSharing: false, muted: false }} />
            {participants.map((p, index) => (
              <VideoParticipant key={index} participant={p} />
            ))}
          </div>
        </div>
        <div className="lg:col-span-1 h-full">
          <CodeEditor />
        </div>
      </main>

      <footer className="py-3 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
        <ControlBar localStream={localStream} />
      </footer>
    </div>
  );
}
