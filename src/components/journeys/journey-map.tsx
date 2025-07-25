
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, useLoadScript, Marker, Polyline } from '@react-google-maps/api';
import type { Stop, Location } from '@/types';
import { Loader2, LocateFixed, Maximize } from 'lucide-react';
import { useTheme } from 'next-themes';
import { toast } from '@/hooks/use-toast';
import { Button } from '../ui/button';
import { cn } from '@/lib/utils';

interface JourneyMapProps {
  stops: (Stop & { parentBookingId?: string })[];
  onLocationSelect?: (location: Location) => void;
  isSelectionMode?: boolean;
  countryCode?: string;
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
    light: [
        {
            featureType: "poi",
            elementType: "labels.icon",
            stylers: [{ "visibility": "off" }]
        },
        {
            featureType: "poi",
            elementType: "labels.text",
            stylers: [{ "visibility": "off" }]
        }
    ],
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
            featureType: "poi",
            elementType: "labels.icon",
            stylers: [{ "visibility": "off" }]
        },
        {
            featureType: "poi",
            elementType: "labels.text",
            stylers: [{ "visibility": "off" }]
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

// A modern, diverse color palette for data visualization
const bookingColors = [
    '#1f77b4', // Muted Blue
    '#ff7f0e', // Safety Orange
    '#2ca02c', // Cooked Asparagus Green
    '#d62728', // Brick Red
    '#9467bd', // Muted Purple
    '#8c564b', // Chestnut Brown
    '#e377c2', // Raspberry Pink
    '#7f7f7f', // Middle Gray
    '#bcbd22', // Curry Yellow-Green
    '#17becf', // Pacific Blue
    '#636EFA', // Indigo
    '#EF553B', // Vermilion
    '#00CC96', // Mint Green
    '#AB63FA', // Amethyst
    '#FFA15A', // Coral
    '#19D3F3', // Cyan
    '#FF6692', // Watermelon Pink
    '#B6E880', // Lime Green
    '#FF97FF', // Orchid Pink
    '#FECB52'  // Saffron Yellow
];

const getBookingColor = (bookingId: string) => {
  if (!bookingId) return '#757575'; // Default gray for stops without a booking ID
  let hash = 0;
  for (let i = 0; i < bookingId.length; i++) {
    hash = bookingId.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash % bookingColors.length);
  return bookingColors[index];
};


export default function JourneyMap({ stops, onLocationSelect, isSelectionMode = false, countryCode }: JourneyMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const { resolvedTheme } = useTheme();
  
  const [center, setCenter] = useState({ lat: 51.5074, lng: -0.1278 });
  
  const fitBounds = useCallback(() => {
      if (mapRef.current && stops && stops.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        stops.forEach(stop => {
          if (stop.location && stop.location.lat && stop.location.lng) {
            bounds.extend(new google.maps.LatLng(stop.location.lat, stop.location.lng));
          }
        });

        if (!bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, {top: 20, bottom: 20, left: 20, right: 20});
        }
      }
  }, [stops]);

  useEffect(() => {
    // Automatically fit bounds when stops change
    fitBounds();
  }, [stops, fitBounds]);
  
  const handleMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    geocoderRef.current = new google.maps.Geocoder();

    if (stops.length === 0 && countryCode) {
        geocoderRef.current.geocode({ 'componentRestrictions': { country: countryCode } }, (results, status) => {
            if (status === 'OK' && results && results[0]) {
                if(results[0].geometry.viewport) {
                    map.fitBounds(results[0].geometry.viewport);
                } else {
                    map.setCenter(results[0].geometry.location);
                    map.setZoom(6);
                }
            } else {
                console.warn(`Geocoding failed for country code ${countryCode}: ${status}`);
            }
        });
    } else if (stops.length > 0) {
        fitBounds();
    }
  }, [countryCode, stops, fitBounds]);
  
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

  const polylinePath = validStops.map(stop => ({
    lat: stop.location.lat,
    lng: stop.location.lng,
  }));
  
  const getMarkerIcon = (stop: Stop & { parentBookingId?: string }, index: number) => {
    const color = getBookingColor(stop.parentBookingId || '');
    const type = stop.stopType === 'pickup' ? 'P' : 'D';
    const label = `${index + 1}`;

    const svg = `
    <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
      <circle cx="20" cy="20" r="16" fill="${color}" stroke="white" stroke-width="2"/>
      <text x="20" y="22" font-family="Arial, sans-serif" font-size="12" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">
        ${label}
      </text>
      <circle cx="32" cy="8" r="7" fill="${color}" stroke="white" stroke-width="1.5"/>
      <text x="32" y="9" font-family="Arial, sans-serif" font-size="9" fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">
        ${type}
      </text>
    </svg>`;
    
    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new window.google.maps.Size(40, 40),
      anchor: new window.google.maps.Point(20, 20),
    };
  };
  
  const mapKey = validStops.map(s => `${s.id}-${s.location.lat}-${s.location.lng}`).join('|');

  return (
    <div style={mapContainerStyle}>
        {isSelectionMode && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 bg-primary text-primary-foreground text-sm font-semibold p-2 rounded-md shadow-lg flex items-center gap-2">
            <LocateFixed className="h-4 w-4" />
            Click on the map to set the address
          </div>
        )}
        <Button 
            variant="secondary" 
            size="icon" 
            onClick={fitBounds} 
            disabled={stops.length < 2}
            className="absolute top-2 right-2 z-10 h-10 w-10 shadow-md"
            title="Fit all stops on screen"
        >
            <Maximize className="h-5 w-5" />
        </Button>
        <GoogleMap
            key={mapKey}
            mapContainerStyle={{ width: '100%', height: '100%', borderRadius: '0.5rem' }}
            center={center}
            zoom={10}
            options={{ 
                styles: resolvedTheme === 'dark' ? mapStyles.dark : mapStyles.light,
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
                icon={getMarkerIcon(stop, index)}
            />
        ))}
        {polylinePath.length > 1 && (
            <Polyline
                path={polylinePath}
                options={{
                    strokeColor: '#007BFF',
                    strokeOpacity: 0.8,
                    strokeWeight: 4,
                    geodesic: true,
                }}
            />
        )}
        </GoogleMap>
    </div>
  );
}
