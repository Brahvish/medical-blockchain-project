import { GlassCard } from "./GlassCard";
import { ExternalLink, Clock, User } from "lucide-react";

interface RecordCardProps {
  cid: string;
  filename: string;        
  description: string;     
  uploadedBy: string;
  timestamp: string;
  index: number;
  onView?: () => void;
}

const shortenAddress = (addr: string) => {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export function RecordCard({
  cid,
  filename,
  description,
  uploadedBy,
  timestamp,
  index,
  onView,
}: RecordCardProps) {
  return (
    <GlassCard className="animate-fade-in" style={{ animationDelay: `${index * 100}ms` }}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* ✅ FILENAME */}
            <p className="text-sm font-semibold text-foreground truncate">
              {filename || "Unnamed File"}
            </p>

            {/* ✅ DESCRIPTION */}
            <p className="text-xs text-muted-foreground mt-1 truncate">
              {description || "No description"}
            </p>

            {/* CID */}
            <p className="text-xs text-muted-foreground mt-2">
              CID: <span className="font-mono">{cid}</span>
            </p>
          </div>
          
          <button
            onClick={onView}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-medical-teal/10 text-medical-teal hover:bg-medical-teal/20 transition-colors text-sm font-medium"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open
          </button>
        </div>
        
        <div className="flex flex-wrap gap-4 pt-2 border-t border-border/50">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <User className="w-3.5 h-3.5" />
            <span>Uploaded by: </span>
            <span className="font-mono text-foreground">{shortenAddress(uploadedBy)}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>{timestamp}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}
