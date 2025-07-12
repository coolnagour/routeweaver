
'use client';

import { useState, useEffect, useCallback } from 'react';
import { Command, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown, Loader2, Building2 } from 'lucide-react';
import { useServer } from '@/context/server-context';
import { searchAccounts } from '@/services/icabbi';
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
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { server } = useServer();
  const { toast } = useToast();

  const handleSearch = useCallback(async (query: string) => {
    if (!server || query.length < 2) {
      setAccounts([]);
      return;
    }
    setIsLoading(true);
    try {
      const results = await searchAccounts(server, query);
      setAccounts(results);
    } catch (error) {
      console.error("Failed to search accounts:", error);
      toast({
        variant: 'destructive',
        title: 'Account Search Failed',
        description: 'Could not retrieve accounts. Please try again.',
      });
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  }, [server, toast]);
  
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSearch = useCallback(debounce(handleSearch, 300), [handleSearch]);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const handleSelect = (account: Account) => {
    setSelectedAccount(account);
    onAccountSelect(account);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
        >
          <Building2 className="mr-2 h-4 w-4 shrink-0" />
          {selectedAccount
            ? `${selectedAccount.name} (${selectedAccount.number})`
            : "Select account..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search account by name..."
            value={searchTerm}
            onValueChange={setSearchTerm}
          />
          <CommandList>
            {isLoading && (
              <div className="p-2 flex items-center justify-center">
                 <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}
            {!isLoading && accounts.length === 0 && searchTerm.length > 1 && (
                <CommandEmpty>No account found.</CommandEmpty>
            )}
            {accounts.map((account) => (
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
    