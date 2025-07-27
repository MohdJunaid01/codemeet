
"use client";

import { useState, useEffect, useRef } from 'react';
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSearchParams } from 'next/navigation';

export default function MeetPage({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [userName, setUserName] = useState('You');
  
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

    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
    }
  }, [localStream, toast]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Meeting ID: {params.id}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        <div className="flex-1 rounded-lg overflow-hidden border border-primary shadow-lg shadow-primary/20">
          {isScreenSharing ? (
              <VideoParticipant participant={{ name: 'You', isScreenSharing: true, stream: localStream, muted: true }} isLarge />
          ) : localStream ? (
              <VideoParticipant participant={{ name: userName, stream: localStream, isScreenSharing: false, muted: false }} isLarge />
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

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <VideoParticipant participant={{ name: userName, stream: localStream, isScreenSharing: false, muted: false }} />
        </div>
      </main>

      <footer className="py-3 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
        <ControlBar localStream={localStream} />
      </footer>
    </div>
  );
}
