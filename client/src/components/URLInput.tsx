import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SiTiktok, SiYoutube, SiFacebook, SiInstagram } from "react-icons/si";
import { Link } from "lucide-react";
import { useState } from "react";

interface URLInputProps {
  onSubmit: (url: string) => void;
}

export function URLInput({ onSubmit }: URLInputProps) {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      onSubmit(url.trim());
      setUrl("");
    }
  };

  const getPlatformIcon = () => {
    if (url.includes('tiktok.com')) return <SiTiktok className="h-4 w-4" />;
    if (url.includes('youtube.com') || url.includes('youtu.be')) return <SiYoutube className="h-4 w-4" />;
    if (url.includes('facebook.com') || url.includes('fb.watch')) return <SiFacebook className="h-4 w-4" />;
    if (url.includes('instagram.com')) return <SiInstagram className="h-4 w-4" />;
    return <Link className="h-4 w-4" />;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex gap-2 items-start">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {getPlatformIcon()}
          </div>
          <Input
            type="url"
            placeholder="Cole a URL do TikTok, YouTube, Facebook ou Instagram"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="pl-10"
            data-testid="input-url"
          />
        </div>
        <Button 
          type="submit" 
          disabled={!url.trim()}
          data-testid="button-analyze-url"
        >
          Analisar
        </Button>
      </div>
      <div className="flex gap-3 text-muted-foreground">
        <SiTiktok className="h-5 w-5" />
        <SiYoutube className="h-5 w-5" />
        <SiFacebook className="h-5 w-5" />
        <SiInstagram className="h-5 w-5" />
      </div>
    </form>
  );
}
