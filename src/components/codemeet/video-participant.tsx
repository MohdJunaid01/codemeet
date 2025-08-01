
"use client";

import { useRef, useEffect } from "react";
import { User, MicOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Participant = {
  id: string;
  name: string;
  stream?: MediaStream;
  muted?: boolean;
};

type VideoParticipantProps = {
  participant: Participant;
  isLocal?: boolean;
};

export function VideoParticipant({ participant, isLocal = false }: VideoParticipantProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  const isAudioMuted = participant.stream?.getAudioTracks().every(t => !t.enabled);
  const isVideoOff = participant.stream?.getVideoTracks().every(t => !t.enabled);

  return (
    <Card className={cn("relative group overflow-hidden rounded-lg aspect-video transition-all duration-300 bg-card border-border")}>
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className={cn("w-full h-full object-cover", { 'hidden': !participant.stream || isVideoOff })} />
      {(!participant.stream || isVideoOff) && (
        <div className="w-full h-full flex items-center justify-center bg-card/80">
            <User className="h-1/3 w-1/3 text-muted-foreground" />
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      
      <div className="absolute bottom-0 left-0 p-3 flex items-center gap-2">
        <span className="text-white text-sm font-medium drop-shadow-md">{participant.name}</span>
        {isAudioMuted && (
          <MicOff className="h-4 w-4 text-white" />
        )}
      </div>
    </Card>
  );
}

    