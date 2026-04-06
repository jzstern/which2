"use client";

import { useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { Celebrity } from "@/lib/types";

interface ResultsCardProps {
  celebrities: [Celebrity, Celebrity];
  explanation: string;
  remaining: number;
  userImage: string;
  onTryAgain: () => void;
}

function CelebrityPhoto({ celebrity }: { celebrity: Celebrity }) {
  const [src, setSrc] = useState(celebrity.imageUrl);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-28 w-28 overflow-hidden rounded-full bg-muted sm:h-36 sm:w-36">
        <Image
          src={src}
          alt={celebrity.name}
          fill
          className="object-cover"
          unoptimized
          onError={() => setSrc("/placeholder-silhouette.svg")}
        />
      </div>
      <h3 className="text-center text-base font-bold sm:text-lg">
        {celebrity.name}
      </h3>
      <p className="text-center text-xs text-muted-foreground sm:text-sm">
        {celebrity.description}
      </p>
    </div>
  );
}

export function ResultsCard({
  celebrities,
  explanation,
  remaining,
  userImage,
  onTryAgain,
}: ResultsCardProps) {
  return (
    <Card className="w-full max-w-2xl">
      <CardContent className="flex flex-col items-center gap-8 pt-6">
        <div className="flex items-center gap-3 sm:gap-6">
          <CelebrityPhoto celebrity={celebrities[0]} />

          <div className="flex flex-col items-center gap-2">
            <div className="relative h-28 w-28 overflow-hidden rounded-full ring-4 ring-primary sm:h-36 sm:w-36">
              <Image
                src={userImage}
                alt="You"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <Badge variant="secondary">You</Badge>
          </div>

          <CelebrityPhoto celebrity={celebrities[1]} />
        </div>

        <p className="max-w-lg text-center text-base text-muted-foreground">
          {explanation}
        </p>

        <div className="flex flex-col items-center gap-3 pb-2">
          <Button size="lg" onClick={onTryAgain}>
            Try again
          </Button>
          <p className="text-sm text-muted-foreground">
            {remaining} of 2 remaining today
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
