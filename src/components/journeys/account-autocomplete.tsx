
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, Building2 } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { searchAccountsByName } from '@/services/icabbi';
import type { Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AccountAutocompleteProps {
  onAccountSelect: (account: Account | null) => void;
  initialAccount?: Account | null;
}

// Simple debounce function
function debounce<F extends (...args: any[]) => any>(func: F, waitFor: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced;
}

export default function AccountAutocomplete({ onAccountSelect, initialAccount }: AccountAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(initialAccount || null);
  const [searchTerm, setSearchTerm] = useState(initialAccount?.name || '');
  const [results, setResults] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { server } = useServer();
  const { toast } = useToast();
  
  useEffect(() => {
    setSelectedAccount(initialAccount || null);
    setSearchTerm(initialAccount?.name || '');
  }, [initialAccount]);

  const handleSearch = useCallback(async (query?: string) => {
    if (!server) {
      setResults([]);
      return;
    }
    
    setIsLoading(true);
    try {
      const accounts = await searchAccountsByName(server, query, { limit: 25 });
      setResults(accounts);
    } catch (error) {
      console.error("Failed to search accounts:", error);
      toast({
        variant: 'destructive',
        title: 'Account Search Failed',
        description: error instanceof Error ? error.message : 'Could not retrieve accounts.',
      });
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [server, toast]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((query: string) => handleSearch(query), 500), [handleSearch]);

  useEffect(() => {
    if (searchTerm.trim() && searchTerm !== selectedAccount?.name) {
      debouncedSearch(searchTerm);
    }
  }, [searchTerm, debouncedSearch, selectedAccount?.name]);

  const onOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && !searchTerm && results.length === 0) {
        // Fetch initial list when opened without a search term
        handleSearch();
    }
  }


  const handleSelect = (account: Account) => {
    setSelectedAccount(account);
    onAccountSelect(account);
    setSearchTerm(account.name || '');
    setOpen(false);
  };
  
  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    if (!value) {
      onAccountSelect(null);
      setSelectedAccount(null);
      setResults([]);
    }
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          {selectedAccount
            ? `${selectedAccount.name} (${selectedAccount.ref})`
            : "Select account..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by account name..."
            value={searchTerm}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {isLoading && (
              <div className="p-2 flex items-center justify-center">
                 <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && results.length === 0 && (
                <CommandEmpty>No account found.</CommandEmpty>
            )}
            {results.map((account) => (
              <CommandItem
                key={account.id}
                value={account.name}
                onSelect={() => handleSelect(account)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span>{account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.ref}</span>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
