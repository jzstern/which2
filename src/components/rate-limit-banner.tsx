import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface RateLimitBannerProps {
  onTryAgain: () => void;
}

export function RateLimitBanner({ onTryAgain }: RateLimitBannerProps) {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
        <p className="text-5xl">🪞</p>
        <h2 className="text-2xl font-bold">
          You&apos;ve used your 2 free looks today
        </h2>
        <p className="text-lg text-muted-foreground">
          Come back tomorrow for more!
        </p>
        <div className="rounded-xl border border-dashed px-8 py-4">
          <p className="text-sm text-muted-foreground">
            Upgrade option coming soon
          </p>
        </div>
        <Button variant="link" onClick={onTryAgain}>
          Back to start
        </Button>
      </CardContent>
    </Card>
  );
}
