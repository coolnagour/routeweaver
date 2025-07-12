
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, Building2 } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { getAccountsByPage } from '@/services/icabbi';
import type { Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AccountAutocompleteProps {
  onAccountSelect: (account: Account | null) => void;
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


export default function AccountAutocomplete({ onAccountSelect }: AccountAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { server } = useServer();
  const { toast } = useToast();
  
  // Use a ref to manage the ongoing search query to prevent race conditions
  const activeSearchQuery = useRef('');

  const searchAccounts = useCallback(async (query: string) => {
    if (!server || !query) {
        setFilteredAccounts([]);
        setIsLoading(false);
        return;
    }

    activeSearchQuery.current = query;
    setIsLoading(true);
    setFilteredAccounts([]);

    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let foundMatch = false;
    const allFetchedAccounts: Account[] = [];

    while (hasMore && !foundMatch && activeSearchQuery.current === query) {
        try {
            const newAccounts = await getAccountsByPage(server, limit, offset);

            if (newAccounts.length === 0) {
                hasMore = false;
                break;
            }
            
            allFetchedAccounts.push(...newAccounts);
            
            const lowercasedQuery = query.toLowerCase();
            const matchingAccounts = allFetchedAccounts.filter(account => 
                account.ref?.toLowerCase().startsWith(lowercasedQuery)
            );

            // If we have found matches with the current set of fetched accounts,
            // update the state and stop fetching more.
            if (matchingAccounts.length > 0) {
                setFilteredAccounts(matchingAccounts);
                foundMatch = true; // Stop the loop
            }

            offset += limit;

        } catch (error) {
            console.error("Failed to search accounts:", error);
            toast({
                variant: 'destructive',
                title: 'Account Search Failed',
                description: 'Could not retrieve accounts. Please try again.',
            });
            hasMore = false; // Stop on error
            break;
        }
    }

    // Ensure we only stop loading if this is the most recent query
    if (activeSearchQuery.current === query) {
        setIsLoading(false);
    }

  }, [server, toast]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce((query: string) => searchAccounts(query), 500), [searchAccounts]);

  useEffect(() => {
    if (searchTerm) {
        debouncedSearch(searchTerm);
    } else {
        // Clear results if search term is empty
        setFilteredAccounts([]);
        activeSearchQuery.current = '';
    }
  }, [searchTerm, debouncedSearch]);


  const handleSelect = (account: Account) => {
    setSelectedAccount(account);
    onAccountSelect(account);
    setSearchTerm(account.ref ? `${account.ref} - ${account.name}` : account.name);
    setOpen(false);
  };
  
  const handleInputChange = (value: string) => {
    setSearchTerm(value);
    if (!value) {
        onAccountSelect(null);
        setSelectedAccount(null);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          onClick={() => setOpen(!open)}
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          {selectedAccount
            ? `${selectedAccount.ref} - ${selectedAccount.name}`
            : "Select account..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by account ref..."
            value={searchTerm}
            onValueChange={handleInputChange}
          />
          <CommandList>
            {isLoading && (
              <div className="p-2 flex items-center justify-center">
                 <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && filteredAccounts.length === 0 && searchTerm.length > 0 && (
                <CommandEmpty>No account found.</CommandEmpty>
            )}
            {filteredAccounts.map((account) => (
              <CommandItem
                key={account.id}
                value={`${account.ref}-${account.name}`}
                onSelect={() => handleSelect(account)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedAccount?.id === account.id ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span><span className="font-bold">{account.ref}</span> - {account.name}</span>
                  <span className="text-xs text-muted-foreground">{account.number}</span>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
    