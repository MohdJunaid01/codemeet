import Image from "next/image";
import { MicOff, Pin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Participant = {
  name: string;
  muted: boolean;
  isScreenSharing: boolean;
  avatar: string;
};

type VideoParticipantProps = {
  participant: Participant;
  isLarge?: boolean;
};

export function VideoParticipant({ participant, isLarge = false }: VideoParticipantProps) {
  return (
    <Card className={cn(
        "relative group overflow-hidden rounded-lg aspect-video transition-all duration-300",
        isLarge ? 'border-primary shadow-lg shadow-primary/20' : 'border-border'
    )}>
      <Image 
        src="https://placehold.co/600x400.png" 
        data-ai-hint="video call"
        alt={`Video feed for ${participant.name}`} 
        fill
        className="object-cover group-hover:scale-105 transition-transform duration-300"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
      
      <div className="absolute bottom-0 left-0 p-3 flex items-center gap-2">
        <span className="text-white text-sm font-medium drop-shadow-lg">{participant.name}</span>
        {participant.muted && (
          <MicOff className="h-4 w-4 text-white p-0.5 bg-red-500 rounded-full" />
        )}
      </div>

      {participant.isScreenSharing && isLarge && (
        <div className="absolute top-3 left-3 bg-primary/80 text-primary-foreground px-2 py-1 rounded-md text-xs font-bold flex items-center gap-1.5">
            <Pin className="h-3 w-3" />
            <span>Screen Share</span>
        </div>
      )}
    </Card>
  );
}
