
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Video, Plus, Calendar, ArrowRight, ChevronDown, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { v4 as uuidv4 } from 'uuid';

export default function HomePage() {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [meetingCode, setMeetingCode] = useState('');

  const handleCreateMeeting = () => {
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name is required',
        description: 'Please enter your name to create or join a meeting.',
      });
      return;
    }
    const newMeetingId = uuidv4();
    router.push(`/meet/${newMeetingId}?name=${encodeURIComponent(name)}`);
  };

  const handleJoinMeeting = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({
        variant: 'destructive',
        title: 'Name is required',
        description: 'Please enter your name to create or join a meeting.',
      });
      return;
    }
    if (!meetingCode.trim()) {
        toast({
            variant: 'destructive',
            title: 'Meeting code is required',
            description: 'Please enter a meeting code to join.',
        });
        return;
    }
    router.push(`/meet/${meetingCode.trim()}?name=${encodeURIComponent(name)}`);
  };

  const handleScheduleMeeting = () => {
    toast({
        title: "Feature not implemented",
        description: "Scheduling is not yet available. You can create an instant meeting instead.",
      });
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
        <header className="absolute top-4 left-4">
             <h1 className="text-2xl font-bold text-primary font-headline flex items-center gap-2">
                <Video />
                CodeMeet
            </h1>
        </header>
      <Card className="w-full max-w-md shadow-lg shadow-primary/10">
        <CardHeader>
          <CardTitle className="text-3xl font-headline text-center">Welcome to CodeMeet</CardTitle>
          <CardDescription className="text-center">
            High-quality video meetings for everyone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                id="name"
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="pl-10"
                />
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2">
             <Button onClick={handleCreateMeeting} className="flex-1" size="lg">
                <Plus className="mr-2 h-5 w-5" />
                New Meeting
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                     <Button variant="secondary" className="px-2">
                        <ChevronDown className="h-5 w-5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleScheduleMeeting}>
                        <Calendar className="mr-2 h-4 w-4" />
                        <span>Schedule for later</span>
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or
              </span>
            </div>
          </div>
          
          <form onSubmit={handleJoinMeeting} className="flex gap-2">
            <Input
              placeholder="Enter a code"
              value={meetingCode}
              onChange={(e) => setMeetingCode(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!meetingCode.trim()}>
              Join
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
      <footer className="absolute bottom-4 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} CodeMeet. All rights reserved.</p>
      </footer>
    </div>
  );
}
