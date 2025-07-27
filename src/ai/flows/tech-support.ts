'use server';

/**
 * @fileOverview An AI tech support agent for a video conferencing app.
 *
 * - techSupport - A function that handles providing tech support.
 * - TechSupportInput - The input type for the techSupport function.
 * - TechSupportOutput - The return type for the techSupport function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const TechSupportInputSchema = z.object({
  issue: z
    .string()
    .describe("The user's description of their technical issue."),
  history: z.array(z.object({
      role: z.enum(['user', 'model']),
      content: z.string(),
  })).optional().describe("The conversation history between the user and the AI assistant."),
});
export type TechSupportInput = z.infer<typeof TechSupportInputSchema>;

const TechSupportOutputSchema = z.object({
  response: z.string().describe("The AI's helpful response to resolve the issue."),
});
export type TechSupportOutput = z.infer<typeof TechSupportOutputSchema>;

export async function techSupport(input: TechSupportInput): Promise<TechSupportOutput> {
  return techSupportFlow(input);
}

const prompt = ai.definePrompt({
  name: 'techSupportPrompt',
  input: {schema: TechSupportInputSchema},
  output: {schema: TechSupportOutputSchema},
  prompt: `You are an AI technical support assistant for a video conferencing application called CodeMeet.
  A user is asking for help with a technical problem.
  Provide a clear, concise, and friendly response to help them solve their issue.
  Assume the user is not highly technical.

  {{#if history}}
  Here is the conversation history. Use it to provide a more relevant response:
  {{#each history}}
  {{#if (eq role 'user')}}User: {{content}}{{/if}}
  {{#if (eq role 'model')}}Assistant: {{content}}{{/if}}
  {{/each}}
  {{/if}}

  User's Current Issue: {{{issue}}}
  `,
});

const techSupportFlow = ai.defineFlow(
  {
    name: 'techSupportFlow',
    inputSchema: TechSupportInputSchema,
    outputSchema: TechSupportOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
