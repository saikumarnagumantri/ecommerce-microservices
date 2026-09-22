import React from 'react';
import { Tabs } from 'expo-router';
import { useCart } from '../../context/CartContext';
import { colors } from '../../theme';

export default function AppTabsLayout() {
  const { itemCount } = useCart();

  return (
    <Tabs
      screenOptions={{
        headerTitleStyle: { fontWeight: '800' },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'SalesCart', tabBarLabel: 'Shop' }} />
      <Tabs.Screen
        name="cart"
        options={{ title: 'Cart', tabBarBadge: itemCount > 0 ? itemCount : undefined }}
      />
      <Tabs.Screen name="orders" options={{ title: 'My Orders', tabBarLabel: 'Orders' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
