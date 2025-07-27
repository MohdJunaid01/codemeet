import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Github, Copy } from "lucide-react";

const placeholderCode = `import React from 'react';

function HelloWorld() {
  // Share your ideas in real-time
  return (
    <div className="hello-world">
      <h1>Hello, Collaborative World!</h1>
      <p>Start coding together with CodeMeet.</p>
    </div>
  );
}

export default HelloWorld;
`;

export function CodeEditor() {
  return (
    <Card className="flex flex-col h-full bg-card/50 border-border/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="grid gap-1">
            <CardTitle className="text-lg font-headline">Collaborative Editor</CardTitle>
            <CardDescription>main.tsx - Synced with GitHub</CardDescription>
          </div>
          <Button variant="ghost" size="icon">
             <Copy className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <Textarea
          defaultValue={placeholderCode}
          className="w-full h-full p-4 font-code text-sm bg-black text-primary border-0 rounded-none resize-none focus-visible:ring-0 focus-visible:ring-offset-0"
          placeholder="Start typing your code here..."
        />
      </CardContent>
      <CardFooter className="p-4">
        <Button className="w-full bg-primary/90 hover:bg-primary text-primary-foreground">
          <Github className="mr-2 h-4 w-4" />
          Sync to GitHub
        </Button>
      </CardFooter>
    </Card>
  );
}
