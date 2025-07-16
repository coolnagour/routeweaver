'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker } from '@react-google-maps/api';
import type { Stop, Location } from '@/types';
import { Loader2, LocateFixed } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '../ui/button';
import { toast } from '@/hooks/use-toast';

interface JourneyMapProps {
  stops: Stop[];
  onLocationSelect?: (location: Location) => void;
  isSelectionMode?: boolean;
}

const libraries: ('places')[] = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
  position: 'relative' as const,
};

// Custom map styles
const mapStyles = {
    light: [],
    dark: [
        { elementType: 'geometry', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#242f3e' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#746855' }] },
        {
          featureType: 'administrative.locality',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }],
        },
        {
          featureType: 'poi',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }],
        },
        {
          featureType: 'poi.park',
          elementType: 'geometry',
          stylers: [{ color: '#263c3f' }],
        },
        {
          featureType: 'poi.park',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#6b9a76' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry',
          stylers: [{ color: '#38414e' }],
        },
        {
          featureType: 'road',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#212a37' }],
        },
        {
          featureType: 'road',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#9ca5b3' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry',
          stylers: [{ color: '#746855' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'geometry.stroke',
          stylers: [{ color: '#1f2835' }],
        },
        {
          featureType: 'road.highway',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#f3d19c' }],
        },
        {
          featureType: 'transit',
          elementType: 'geometry',
          stylers: [{ color: '#2f3948' }],
        },
        {
          featureType: 'transit.station',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#d59563' }],
        },
        {
          featureType: 'water',
          elementType: 'geometry',
          stylers: [{ color: '#17263c' }],
        },
        {
          featureType: 'water',
          elementType: 'labels.text.fill',
          stylers: [{ color: '#515c6d' }],
        },
        {
          featureType: 'water',
          elementType: 'labels.text.stroke',
          stylers: [{ color: '#17263c' }],
        },
    ]
};

export default function JourneyMap({ stops, onLocationSelect, isSelectionMode = false }: JourneyMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const { theme } = useTheme();
  
  const [center, setCenter] = useState({ lat: 53.3498, lng: -6.2603 }); // Default to Dublin

  useEffect(() => {
    if (mapRef.current && stops && stops.length > 0) {
      const bounds = new google.maps.LatLngBounds();
      stops.forEach(stop => {
        if (stop.location && stop.location.lat && stop.location.lng) {
          bounds.extend(new google.maps.LatLng(stop.location.lat, stop.location.lng));
        }
      });

      if (!bounds.isEmpty()) {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [stops]);
  
  const handleMapLoad = (map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();
  };
  
  const handleInternalMapClick = (e: google.maps.MapMouseEvent) => {
    if (!onLocationSelect || !isSelectionMode || !geocoderRef.current || !e.latLng) return;

    geocoderRef.current.geocode({ location: e.latLng }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const location: Location = {
          address: results[0].formatted_address,
          lat: e.latLng!.lat(),
          lng: e.latLng!.lng(),
        };
        onLocationSelect(location);
      } else {
        console.error(`Geocode was not successful for the following reason: ${status}`);
        toast({
          variant: "destructive",
          title: "Could not find address",
          description: "Please try clicking a different location on the map.",
        });
      }
    });
  };

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return (
    <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const validStops = stops.filter(stop => stop.location && stop.location.lat && stop.location.lng);

  return (
    <div style={mapContainerStyle}>
        {isSelectionMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground text-sm font-semibold p-2 rounded-md shadow-lg flex items-center gap-2">
            <LocateFixed className="h-4 w-4" />
            Click on the map to set the address
          </div>
        )}
        <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
            center={center}
            zoom={10}
            options={{ 
                styles: theme === 'dark' ? mapStyles.dark : mapStyles.light,
                disableDefaultUI: true,
                zoomControl: true,
                draggableCursor: isSelectionMode ? 'crosshair' : undefined,
            }}
            onLoad={handleMapLoad}
            onClick={handleInternalMapClick}
        >
        {validStops.map((stop, index) => (
            <Marker
            key={`${stop.id}-${index}`}
            position={{ lat: stop.location.lat, lng: stop.location.lng }}
            label={(index + 1).toString()}
            />
        ))}
        </GoogleMap>
    </div>
  );
}
