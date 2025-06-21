"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, X } from 'lucide-react';

interface StylizedPreviewProps {
  isLoading: boolean;
  imageDataUrl: string | null;
  onAdopt: () => void;
  onDismiss: () => void;
}

export function StylizedPreview({
  isLoading,
  imageDataUrl,
  onAdopt,
  onDismiss,
}: StylizedPreviewProps) {
  return (
    <Card className="w-64 shadow-2xl animate-in fade-in zoom-in-95">
      <CardHeader>
        <CardTitle className="text-base font-semibold">AI Suggestion</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : imageDataUrl ? (
          <Image
            src={imageDataUrl}
            alt="Stylized drawing"
            width={200}
            height={160}
            className="rounded-md object-contain w-full h-40"
            data-ai-hint="stylized drawing"
          />
        ) : null}
      </CardContent>
      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" size="icon" onClick={onDismiss} aria-label="Dismiss suggestion">
          <X className="h-4 w-4" />
        </Button>
        <Button onClick={onAdopt} disabled={!imageDataUrl || isLoading} aria-label="Adopt suggestion">
          <Check className="h-4 w-4" />
          Adopt
        </Button>
      </CardFooter>
    </Card>
  );
}
