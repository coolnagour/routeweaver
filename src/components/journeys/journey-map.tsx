
'use client';

import { useState, useEffect, useRef } from 'react';
import { GoogleMap, useLoadScript, Marker, Polyline } from '@react-google-maps/api';
import type { Stop } from '@/types';
import { Loader2, MapPin } from 'lucide-react';
import { useTheme } from 'next-themes';

interface JourneyMapProps {
  stops: Stop[];
}

const libraries: ('places')[] = ['places'];
const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '0.5rem',
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

export default function JourneyMap({ stops }: JourneyMapProps) {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries,
  });

  const mapRef = useRef<google.maps.Map | null>(null);
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

      if (bounds.isEmpty()) {
        // This case handles stops that might have location objects but invalid lat/lng.
        // It prevents the map from zooming to (0,0).
        if(stops[0]?.location.lat && stops[0]?.location.lng) {
            mapRef.current.setCenter({lat: stops[0].location.lat, lng: stops[0].location.lng});
            mapRef.current.setZoom(12);
        }
      } else {
        mapRef.current.fitBounds(bounds);
      }
    }
  }, [stops]);

  if (loadError) return <div>Error loading maps</div>;
  if (!isLoaded) return (
    <div className="flex h-full w-full items-center justify-center bg-muted rounded-lg">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  const validStops = stops.filter(stop => stop.location && stop.location.lat && stop.location.lng);

  return (
    <GoogleMap
      mapContainerStyle={mapContainerStyle}
      center={center}
      zoom={10}
      options={{ 
        styles: theme === 'dark' ? mapStyles.dark : mapStyles.light,
        disableDefaultUI: true,
        zoomControl: true,
      }}
      onLoad={ref => mapRef.current = ref}
    >
      {validStops.map((stop, index) => (
        <Marker
          key={`${stop.id}-${index}`}
          position={{ lat: stop.location.lat, lng: stop.location.lng }}
          label={(index + 1).toString()}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            fillColor: stop.stopType === 'pickup' ? '#16a34a' : '#dc2626', // green for pickup, red for dropoff
            fillOpacity: 1,
            strokeColor: 'white',
            strokeWeight: 2,
            scale: 12,
          }}
        />
      ))}
      {validStops.length > 1 && (
        <Polyline
          path={validStops.map(stop => ({ lat: stop.location.lat, lng: stop.location.lng }))}
          options={{
            strokeColor: '#4f46e5', // A nice indigo color
            strokeOpacity: 0.8,
            strokeWeight: 3,
          }}
        />
      )}
    </GoogleMap>
  );
}
