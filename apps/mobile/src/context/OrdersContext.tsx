import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as ordersApi from '../api/orders';
import { useAuth } from './AuthContext';

interface OrdersContextValue {
  unseenCount: number;
  refresh: () => Promise<void>;
}

const OrdersContext = createContext<OrdersContextValue | undefined>(undefined);

export function OrdersProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) {
      setUnseenCount(0);
      return;
    }
    const result = await ordersApi.getOrders();
    setUnseenCount(result.data.filter((o) => o.hasUnseenUpdate).length);
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <OrdersContext.Provider value={{ unseenCount, refresh }}>{children}</OrdersContext.Provider>;
}

export function useOrdersBadge(): OrdersContextValue {
  const ctx = useContext(OrdersContext);
  if (!ctx) throw new Error('useOrdersBadge must be used within an OrdersProvider');
  return ctx;
}
