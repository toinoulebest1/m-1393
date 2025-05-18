
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { searchArtist, getArtistById, ArtistProfileResponse } from "@/services/deezerApi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Player } from "@/components/Player";
import { ArrowLeft, Play, Music, Disc, User, Heart, Award, Calendar, ExternalLink } from "lucide-react";
import { usePlayer } from "@/contexts/PlayerContext";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";

const ArtistProfile = () => {
  const { artistId, artistName } = useParams();
  const [profileData, setProfileData] = useState<ArtistProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { play } = usePlayer();

  useEffect(() => {
    const fetchArtistData = async () => {
      setLoading(true);
      try {
        let data = null;
        
        if (artistId && !isNaN(parseInt(artistId))) {
          data = await getArtistById(parseInt(artistId));
        } else if (artistName) {
          data = await searchArtist(artistName);
        }
        
        if (data) {
          setProfileData(data);
        } else {
          toast.error("Impossible de trouver les informations de l'artiste");
        }
      } catch (error) {
        console.error("Error loading artist:", error);
        toast.error("Erreur lors du chargement du profil de l'artiste");
      } finally {
        setLoading(false);
      }
    };
    
    fetchArtistData();
  }, [artistId, artistName]);

  const handlePlayPreview = (preview: string, title: string, artist: string, imageUrl: string) => {
    const previewTrack = {
      id: Math.random().toString(),
      url: preview,
      title: title,
      artist: artist,
      imageUrl: imageUrl,
      duration: '0:30'
    };
    
    play(previewTrack);
  };

  const formatFanCount = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M fans`;
    } else if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K fans`;
    }
    return `${count} fans`;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <div className="flex-1 overflow-y-auto w-full pb-28">
        <div className="max-w-6xl mx-auto p-4 md:p-8">
          <Button 
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
          
          {loading ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row gap-6">
                <Skeleton className="h-64 w-64 rounded-lg" />
                <div className="space-y-4 flex-1">
                  <Skeleton className="h-12 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-20 w-full" />
                </div>
              </div>
              
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full rounded" />
                  ))}
                </div>
              </div>
              
              <div>
                <Skeleton className="h-8 w-40 mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-48 w-full rounded" />
                  ))}
                </div>
              </div>
            </div>
          ) : profileData ? (
            <div className="space-y-8 animate-fade-in">
              <div className="flex flex-col md:flex-row gap-6">
                <div className="relative group">
                  <img 
                    src={profileData.artist.picture_xl || '/placeholder.svg'} 
                    alt={profileData.artist.name}
                    className="w-64 h-64 object-cover rounded-lg shadow-lg transition-transform group-hover:scale-[1.02]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                    <a 
                      href={profileData.artist.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-white flex items-center gap-2 px-4 py-2 bg-spotify-accent rounded-full hover:bg-spotify-accent/90"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Voir sur Deezer
                    </a>
                  </div>
                </div>
                
                <div className="flex-1 space-y-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold">{profileData.artist.name}</h1>
                    <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Heart className="h-4 w-4" />
                        <span>{formatFanCount(profileData.artist.nb_fan)}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Disc className="h-4 w-4" />
                        <span>{profileData.artist.nb_album} albums</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap gap-2 mt-2">
                    {profileData.topTracks.slice(0, 3).map(track => (
                      <Button 
                        key={track.id}
                        variant="outline" 
                        size="sm" 
                        className="gap-1"
                        onClick={() => handlePlayPreview(track.preview, track.title, track.artist.name, track.album.cover_medium)}
                      >
                        <Play className="h-3 w-3" />
                        {track.title.length > 20 ? `${track.title.substring(0, 20)}...` : track.title}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
              
              {profileData.topTracks.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    Top Titres
                  </h2>
                  <div className="space-y-2">
                    {profileData.topTracks.map(track => (
                      <Card key={track.id} className="hover:bg-muted/50 transition-colors">
                        <CardContent className="p-3">
                          <div className="flex items-center gap-3">
                            <img 
                              src={track.album.cover_medium} 
                              alt={track.title}
                              className="h-14 w-14 rounded object-cover"
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-medium truncate">{track.title}</h3>
                              <p className="text-sm text-muted-foreground truncate">{track.album.title}</p>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="shrink-0"
                              onClick={() => handlePlayPreview(track.preview, track.title, track.artist.name, track.album.cover_medium)}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              
              {profileData.albums.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Disc className="h-5 w-5" />
                    Albums
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {profileData.albums.map(album => (
                      <Card key={album.id} className="overflow-hidden hover:bg-muted/50 transition-colors border-border">
                        <div className="aspect-square overflow-hidden">
                          <img 
                            src={album.cover_medium} 
                            alt={album.title}
                            className="w-full h-full object-cover transition-transform hover:scale-105"
                          />
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-medium truncate">{album.title}</h3>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Calendar className="h-3 w-3" />
                            {album.release_date ? new Date(album.release_date).getFullYear() : "N/A"}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <User className="h-16 w-16 mb-4 opacity-50" />
              <h2 className="text-2xl font-medium">Artiste non trouvé</h2>
              <p className="mt-2 max-w-md">Les informations sur cet artiste n'ont pas pu être récupérées depuis Deezer.</p>
              <Button 
                variant="default" 
                className="mt-6"
                onClick={() => navigate('/')}
              >
                Retourner à l'accueil
              </Button>
            </div>
          )}
        </div>
      </div>
      <Player />
    </div>
  );
};

export default ArtistProfile;
