import { Link, useLocation } from "wouter";
import { Home, Package, Store, User, MapPin, ShoppingCart, Tag, UtensilsCrossed, ChefHat, LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppMode } from "@/hooks/useAppMode";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  icon: LucideIcon | (() => null);
  label: string;
  active: boolean;
  disabled?: boolean;
}

export default function BottomNavbar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const { mode } = useAppMode();

  // Role-based navigation items
  const sellerNavItems: NavItem[] = [
    {
      href: "/seller/dashboard",
      icon: Home,
      label: "Dashboard",
      active: location.startsWith("/seller/dashboard"),
      disabled: false
    },
    {
      href: "/seller/store",
      icon: Store,
      label: "Store",
      active: location.startsWith("/seller/store"),
      disabled: false
    },
    {
      href: "/seller/orders",
      icon: ShoppingCart,
      label: "Orders",
      active: location.startsWith("/seller/orders"),
      disabled: false
    },
    {
      href: "/seller/inventory",
      icon: Package,
      label: "Inventory",
      active: location.startsWith("/seller/inventory"),
      disabled: false
    },
    {
      href: "/account",
      icon: User,
      label: "Account",
      active: location.startsWith("/account"),
      disabled: false
    }
  ];

  const customerNavItems: NavItem[] = [
    {
      href: "/",
      icon: Home,
      label: "Home",
      active: location === "/",
      disabled: false
    },
    ...(mode === 'shopping' ? [
      {
        href: "/products",
        icon: Package,
        label: "Products",
        active: location.startsWith("/products"),
        disabled: false
      },
      {
        href: "/stores",
        icon: Store,
        label: "Stores",
        active: location.startsWith("/stores"),
        disabled: false
      },
      {
        href: "/store-maps",
        icon: MapPin,
        label: "Map",
        active: location === "/store-maps",
        disabled: false
      }
    ] : [
      {
        href: "/food-categories",
        icon: UtensilsCrossed,
        label: "Menu",
        active: location.startsWith("/food-categories") || location.startsWith("/categories"),
        disabled: false
      },
      {
        href: "/restaurants",
        icon: ChefHat,
        label: "Restaurants",
        active: location.startsWith("/restaurants"),
        disabled: false
      },
      {
        href: "/restaurant-maps",
        icon: MapPin,
        label: "Map",
        active: location === "/restaurant-maps",
        disabled: false
      }
    ] as NavItem[]),
    {
      href: user ? "/account" : "/login",
      icon: User,
      label: "Account",
      active: location.startsWith("/account") || location.startsWith("/customer-dashboard"),
      disabled: false
    }
  ] as NavItem[];

  const navItems = user?.role === "shopkeeper" ? sellerNavItems : customerNavItems;

  // Ensure we always have exactly 5 items for consistent layout
  const getNavItems = (): NavItem[] => {
    const items = [...navItems];
    // If less than 5 items, add placeholders to make it 5
    while (items.length < 5) {
      items.push({
        href: "#",
        icon: (() => null) as unknown as LucideIcon, // Type assertion for the icon
        label: "",
        active: false,
        disabled: true
      });
    }
    // If more than 5, take first 5
    return items.slice(0, 5) as NavItem[];
  };

  // Add a style tag to handle mobile viewport
  const viewportFix = `
    @supports (padding-bottom: env(safe-area-inset-bottom)) {
      body {
        padding-bottom: env(safe-area-inset-bottom);
      }
    }
    
    /* Fix for iOS 15+ Safari */
    @media (max-width: 768px) {
      body {
        position: fixed;
        width: 100%;
        height: 100%;
      }
    }
  `;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: viewportFix }} />
      <nav 
        className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 z-40"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          transform: 'translateZ(0)',
          WebkitTransform: 'translateZ(0)',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div 
          className="flex h-16 px-1" 
          style={{
            height: 'calc(4rem + env(safe-area-inset-bottom, 0px))',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)'
          }}
        >
          {getNavItems().map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href !== "#" ? item.href : `placeholder-${index}`}
                href={item.href}
                className={cn(
                  "flex-1 flex flex-col items-center justify-center rounded-lg transition-colors p-1 min-w-0",
                  item.active
                    ? "text-primary bg-primary/10"
                    : "text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-primary/5",
                  item.disabled ? "pointer-events-none opacity-0" : ""
                )}
                aria-disabled={item.disabled}
              >
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="text-[10px] xs:text-xs font-medium text-center leading-tight mt-0.5 px-1 truncate w-full">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}