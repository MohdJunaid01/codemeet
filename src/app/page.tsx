import { CodeEditor } from "@/components/codemeet/code-editor";
import { ControlBar } from "@/components/codemeet/control-bar";
import { VideoParticipant } from "@/components/codemeet/video-participant";

export default function Home() {
  const participants = [
    { name: 'Alex', muted: false, isScreenSharing: false, avatar: 'https://i.pravatar.cc/300?u=alex' },
    { name: 'Sarah', muted: true, isScreenSharing: false, avatar: 'https://i.pravatar.cc/300?u=sarah' },
    { name: 'Chris', muted: false, isScreenSharing: true, avatar: 'https://i.pravatar.cc/300?u=chris' },
    { name: 'You', muted: false, isScreenSharing: false, avatar: 'https://i.pravatar.cc/300?u=you' },
  ];

  const screenSharer = participants.find(p => p.isScreenSharing);

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
          {screenSharer ? (
            <div className="flex-1 rounded-lg overflow-hidden border border-primary shadow-lg shadow-primary/20">
              <VideoParticipant participant={screenSharer} isLarge />
            </div>
          ) : (
             <div className="w-full h-full bg-card rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">No one is sharing their screen.</p>
             </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <ControlBar />
      </footer>
    </div>
  );
}
