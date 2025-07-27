"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MeetingSummary } from "@/components/codemeet/meeting-summary";
import { Mic, Video, ScreenShare, PhoneOff, BrainCircuit } from "lucide-react";

export function ControlBar() {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSummaryOpen, setSummaryOpen] = useState(false);

  return (
    <div className="flex items-center justify-between">
       <div className="text-sm text-muted-foreground">
        <p>In call with 3 others</p>
      </div>

      <div className="flex items-center gap-2">
        <Button variant={isMuted ? "destructive" : "secondary"} size="lg" onClick={() => setIsMuted(!isMuted)} className="rounded-full w-14 h-14">
          <Mic className="h-6 w-6" />
        </Button>
        <Button variant={isVideoOff ? "destructive" : "secondary"} size="lg" onClick={() => setIsVideoOff(!isVideoOff)} className="rounded-full w-14 h-14">
          <Video className="h-6 w-6" />
        </Button>
        <Button variant="secondary" size="lg" className="rounded-full w-14 h-14">
          <ScreenShare className="h-6 w-6" />
        </Button>
         <MeetingSummary isOpen={isSummaryOpen} onOpenChange={setSummaryOpen}>
            <Button variant="secondary" size="lg" className="rounded-full w-14 h-14 text-accent">
                <BrainCircuit className="h-6 w-6" />
            </Button>
        </MeetingSummary>
      </div>

      <Button variant="destructive" size="lg" className="h-12 px-6">
        <PhoneOff className="mr-2 h-5 w-5" />
        End Call
      </Button>
    </div>
  );
}
