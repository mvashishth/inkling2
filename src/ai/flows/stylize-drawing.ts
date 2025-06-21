'use server';

/**
 * @fileOverview An AI tool that interprets the user's strokes and suggests stylized versions of the drawing.
 *
 * - stylizeDrawing - A function that handles the drawing stylization process.
 * - StylizeDrawingInput - The input type for the stylizeDrawing function.
 * - StylizeDrawingOutput - The return type for the stylizeDrawing function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const StylizeDrawingInputSchema = z.object({
  drawingDataUri: z
    .string()
    .describe(
      "A drawing as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type StylizeDrawingInput = z.infer<typeof StylizeDrawingInputSchema>;

const StylizeDrawingOutputSchema = z.object({
  stylizedDrawingDataUri: z
    .string()
    .describe(
      "A stylized version of the drawing, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type StylizeDrawingOutput = z.infer<typeof StylizeDrawingOutputSchema>;

export async function stylizeDrawing(input: StylizeDrawingInput): Promise<StylizeDrawingOutput> {
  return stylizeDrawingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'stylizeDrawingPrompt',
  input: {schema: StylizeDrawingInputSchema},
  output: {schema: StylizeDrawingOutputSchema},
  prompt: `You are an AI that stylizes drawings.  The user will pass in a drawing, and you should return a stylized version of that drawing.

  Here is the drawing to stylize:
  {{media url=drawingDataUri}}
  `,
  config: {
    safetySettings: [
      {
        category: 'HARM_CATEGORY_HATE_SPEECH',
        threshold: 'BLOCK_ONLY_HIGH',
      },
      {
        category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
        threshold: 'BLOCK_NONE',
      },
      {
        category: 'HARM_CATEGORY_HARASSMENT',
        threshold: 'BLOCK_MEDIUM_AND_ABOVE',
      },
      {
        category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
        threshold: 'BLOCK_LOW_AND_ABOVE',
      },
    ],
  },
});

const stylizeDrawingFlow = ai.defineFlow(
  {
    name: 'stylizeDrawingFlow',
    inputSchema: StylizeDrawingInputSchema,
    outputSchema: StylizeDrawingOutputSchema,
  },
  async input => {
    const {media} = await ai.generate({
      model: 'googleai/gemini-2.0-flash-preview-image-generation',
      prompt: [
        {media: {url: input.drawingDataUri}},
        {text: 'Stylize this drawing.'},
      ],
      config: {
        responseModalities: ['TEXT', 'IMAGE'],
      },
    });

    return {stylizedDrawingDataUri: media!.url!};
  }
);
