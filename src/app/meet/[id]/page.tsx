
"use client";

import { useState, useEffect, useRef } from 'react';
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useSearchParams, useParams } from 'next/navigation';

export default function MeetPage() {
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const params = useParams();
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [userName, setUserName] = useState('You');
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
    
    // Only get media if permission hasn't been determined yet
    if (hasPermission === false) {
        getMedia();
    }


    return () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="p-4 border-b border-border flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary font-headline">CodeMeet</h1>
        <div className="text-sm text-muted-foreground">
          Meeting ID: {id}
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-4 p-4 overflow-hidden">
        <div className="flex-1 rounded-lg overflow-hidden border border-primary shadow-lg shadow-primary/20">
          {isScreenSharing ? (
              <VideoParticipant participant={{ name: 'You', isScreenSharing: true, stream: localStream, muted: true }} isLarge />
          ) : localStream ? (
              <VideoParticipant participant={{ name: userName, stream: localStream, isScreenSharing: false, muted: true }} isLarge />
          ) : (
              <div className="w-full h-full bg-card rounded-lg flex items-center justify-center">
                {hasPermission === false && (
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
      </main>

      <footer className="py-3 px-4 border-t border-border bg-background/80 backdrop-blur-sm">
        <ControlBar localStream={localStream} />
      </footer>
    </div>
  );
}
