
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MeetingSummary } from "@/components/codemeet/meeting-summary";
import { Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, BrainCircuit, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from 'next/navigation';

type ControlBarProps = {
  localStream: MediaStream | null;
};

export function ControlBar({ localStream }: ControlBarProps) {
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSummaryOpen, setSummaryOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => track.enabled = !isAudioMuted);
    }
  }, [localStream, isAudioMuted]);
  
  useEffect(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => track.enabled = !isVideoOff);
    }
  }, [localStream, isVideoOff]);

  const toggleAudio = () => setIsAudioMuted(prev => !prev);
  const toggleVideo = () => setIsVideoOff(prev => !prev);

  const handleInvite = () => {
    const meetingLink = window.location.href;
    navigator.clipboard.writeText(meetingLink);
    toast({
      title: "Invite Link Copied!",
      description: "You can now share the link with others.",
    });
  };

  const handleEndCall = () => {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    router.push('/');
  }

  return (
    <div className="flex items-center justify-between">
       <div className="text-sm text-muted-foreground">
        <p>In call with 3 others</p>
      </div>

      <div className="flex items-center gap-2">
        <Button 
            variant="secondary" 
            size="lg" 
            onClick={handleInvite} 
            className="rounded-full w-14 h-14"
            >
          <Users className="h-6 w-6" />
        </Button>
        <Button 
            variant={isAudioMuted ? "destructive" : "secondary"} 
            size="lg" 
            onClick={toggleAudio} 
            className="rounded-full w-14 h-14"
            disabled={!localStream}
            >
          {isAudioMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </Button>
        <Button 
            variant={isVideoOff ? "destructive" : "secondary"} 
            size="lg" 
            onClick={toggleVideo} 
            className="rounded-full w-14 h-14"
            disabled={!localStream}
            >
          {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
        </Button>
        <Button variant="secondary" size="lg" className="rounded-full w-14 h-14" disabled={!localStream}>
          <ScreenShare className="h-6 w-6" />
        </Button>
         <MeetingSummary isOpen={isSummaryOpen} onOpenChange={setSummaryOpen}>
            <Button variant="secondary" size="lg" className="rounded-full w-14 h-14 text-accent">
                <BrainCircuit className="h-6 w-6" />
            </Button>
        </MeetingSummary>
      </div>

      <Button variant="destructive" size="lg" className="h-12 px-6" onClick={handleEndCall}>
        <PhoneOff className="mr-2 h-5 w-5" />
        End Call
      </Button>
    </div>
  );
}
