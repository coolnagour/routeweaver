
'use client';

import { Autocomplete, useLoadScript } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { MapPin, LocateFixed } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import type { Location, Stop } from "@/types";
import { useServer } from "@/context/server-context";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import JourneyMap from "./journey-map";

interface AddressAutocompleteProps {
  value: string;
  onChange: (location: Location) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
  stopsForMapContext?: Stop[]; // Pass all stops for map context
}

const libraries: ("places")[] = ["places"];

const darkThemeStyles = `
  .pac-container {
    background-color: hsl(var(--popover));
    border-color: hsl(var(--border));
    border-radius: var(--radius);
  }
  .pac-item {
    color: hsl(var(--popover-foreground));
    border-top: 1px solid hsl(var(--border));
  }
  .pac-item:first-child {
    border-top: none;
  }
  .pac-item-query {
    color: hsl(var(--popover-foreground));
  }
  .pac-item:hover {
    background-color: hsl(var(--accent));
  }
  .pac-matched {
    color: hsl(var(--primary));
  }
`;

export default function AddressAutocomplete({ 
  value, 
  onChange, 
  placeholder, 
  className, 
  disabled = false,
  stopsForMapContext = []
}: AddressAutocompleteProps) {
  const { server } = useServer();
  const { theme } = useTheme();
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: libraries,
  });

  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);
  const [inputValue, setInputValue] = useState(value);
  const [isMapDialogOpen, setIsMapDialogOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  
  useEffect(() => {
    const styleTagId = 'google-maps-dark-theme';
    let styleTag = document.getElementById(styleTagId) as HTMLStyleElement | null;

    if (theme === 'dark') {
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleTagId;
        styleTag.type = 'text/css';
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = darkThemeStyles;
    } else {
      if (styleTag) {
        styleTag.innerHTML = '';
      }
    }
  }, [theme]);

  const onLoad = (autocompleteInstance: google.maps.places.Autocomplete) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      const address = place.formatted_address || '';
      const lat = place.geometry?.location?.lat() || 0;
      const lng = place.geometry?.location?.lng() || 0;
      setInputValue(address);
      onChange({ address, lat, lng });
    } else {
      console.log('Autocomplete is not loaded yet!');
    }
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value);
    if (e.target.value === '') {
        onChange({ address: '', lat: 0, lng: 0 });
    }
  }

  const handleLocationSelectFromMap = (location: Location) => {
    setInputValue(location.address);
    onChange(location);
    setIsMapDialogOpen(false);
  }

  useEffect(() => {
    setInputValue(value);
  }, [value]);


  if (!isLoaded) {
    return (
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Loading maps..."
          className="pl-10 bg-muted"
          disabled
        />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Autocomplete
        key={server?.companyId}
        onLoad={onLoad}
        onPlaceChanged={onPlaceChanged}
        options={{
          types: ['address'],
          componentRestrictions: server && server.countryCodes ? { country: server.countryCodes } : undefined,
        }}
        disabled={disabled}
        className="w-full"
      >
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            value={inputValue}
            onChange={handleInputChange}
            className={cn(`pl-10`, className)}
            disabled={disabled}
          />
        </div>
      </Autocomplete>
      <Dialog open={isMapDialogOpen} onOpenChange={setIsMapDialogOpen}>
        <DialogTrigger asChild>
            <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                title="Set address from map"
                disabled={disabled}
            >
                <LocateFixed className="h-4 w-4"/>
            </Button>
        </DialogTrigger>
        <DialogContent className="max-w-3xl h-[80vh]">
             <DialogHeader>
                <DialogTitle>Select Address from Map</DialogTitle>
             </DialogHeader>
             <div className="h-full w-full py-4">
                <JourneyMap 
                    stops={stopsForMapContext} 
                    onLocationSelect={handleLocationSelectFromMap} 
                    isSelectionMode={true}
                />
             </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
