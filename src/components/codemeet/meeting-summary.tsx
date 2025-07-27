"use client";

import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { summarizeMeeting } from "@/ai/flows/summarize-meeting";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Copy } from "lucide-react";
import { ScrollArea } from "../ui/scroll-area";

const formSchema = z.object({
  transcript: z.string().min(50, {
    message: "Transcript must be at least 50 characters.",
  }),
});

type MeetingSummaryProps = {
  children: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MeetingSummary({ children, isOpen, onOpenChange }: MeetingSummaryProps) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState("");
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      transcript: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    setSummary("");
    try {
      const result = await summarizeMeeting({ transcript: values.transcript });
      setSummary(result.summary);
    } catch (error) {
      console.error("Error summarizing meeting:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to generate summary. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    toast({
      title: "Copied!",
      description: "Summary copied to clipboard.",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle className="text-primary font-headline">AI Meeting Assistant</DialogTitle>
          <DialogDescription>
            Paste the meeting transcript below to get a concise summary.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
            {!summary && (
            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                    control={form.control}
                    name="transcript"
                    render={({ field }) => (
                    <FormItem>
                        <FormLabel>Meeting Transcript</FormLabel>
                        <FormControl>
                        <Textarea
                            placeholder="Paste your full meeting transcript here..."
                            className="min-h-[200px] font-code text-xs"
                            {...field}
                        />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                    )}
                />
                <Button type="submit" disabled={loading} className="w-full">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Generate Summary
                </Button>
                </form>
            </Form>
            )}

            {loading && !summary && (
                <div className="flex flex-col items-center justify-center gap-2 h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Generating summary...</p>
                </div>
            )}
            
            {summary && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-lg">Meeting Summary</h3>
                        <Button variant="ghost" size="icon" onClick={handleCopy}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                    <ScrollArea className="h-64">
                      <div className="p-4 bg-muted/50 rounded-md prose prose-sm dark:prose-invert max-w-none">
                          <p>{summary}</p>
                      </div>
                    </ScrollArea>
                </div>
            )}
        </div>
        <DialogFooter>
            {summary && (
                 <Button variant="outline" onClick={() => { setSummary(''); form.reset(); }}>
                    Summarize Another
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
