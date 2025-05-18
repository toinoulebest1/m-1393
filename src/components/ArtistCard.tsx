
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { User } from 'lucide-react';
import { DeezerArtist } from '@/services/deezerApi';

interface ArtistCardProps {
  artist: DeezerArtist;
  className?: string;
}

const ArtistCard = ({ artist, className = '' }: ArtistCardProps) => {
  const navigate = useNavigate();
  
  const handleClick = () => {
    navigate(`/artist/${artist.id}`);
  };
  
  const formatFanCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count;
  };
  
  return (
    <Card 
      className={`cursor-pointer hover:bg-muted/50 transition-all hover:scale-[1.02] ${className}`}
      onClick={handleClick}
    >
      <CardContent className="p-3 flex flex-col items-center text-center">
        <div className="w-full aspect-square overflow-hidden rounded-full mb-2">
          {artist.picture_medium ? (
            <img 
              src={artist.picture_medium} 
              alt={artist.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <User className="h-1/3 w-1/3 text-muted-foreground" />
            </div>
          )}
        </div>
        <h3 className="font-medium truncate w-full">{artist.name}</h3>
        <p className="text-xs text-muted-foreground mt-1">{formatFanCount(artist.nb_fan)} fans</p>
      </CardContent>
    </Card>
  );
};

export default ArtistCard;
