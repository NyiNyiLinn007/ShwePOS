'use client';

import React from 'react';
import {
  LayoutDashboard,
  ShoppingCart,
  Clock,
  Package,
  Tags,
  Boxes,
  Receipt,
  Users,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  Banknote,
  CreditCard,
  Smartphone,
  FileSpreadsheet,
  Split,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  RotateCcw,
  Plus,
  Minus,
  Search,
  X,
  Pencil,
  Trash2,
  Eye,
  Printer,
  Barcode,
  PauseCircle,
  PlayCircle,
  Ban,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Download,
  Upload,
  Filter,
  Calendar,
  User,
  Percent,
  Star,
  Wifi,
  WifiOff,
  RefreshCw,
  FolderOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Image as ImageIcon,
} from 'lucide-react';

export {
  LayoutDashboard,
  ShoppingCart,
  Clock,
  Package,
  Tags,
  Boxes,
  Receipt,
  Users,
  Wallet,
  BarChart3,
  UserCog,
  Settings,
  Banknote,
  CreditCard,
  Smartphone,
  FileSpreadsheet,
  Split,
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  RotateCcw,
  Plus,
  Minus,
  Search,
  X,
  Pencil,
  Trash2,
  Eye,
  Printer,
  Barcode,
  PauseCircle,
  PlayCircle,
  Ban,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Sun,
  Moon,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  Download,
  Upload,
  Filter,
  Calendar,
  User,
  Percent,
  Star,
  Wifi,
  WifiOff,
  RefreshCw,
  FolderOpen,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  ImageIcon,
};

export function NavIcon({
  navKey,
  size = 18,
}: {
  navKey: string;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.75 };
  switch (navKey) {
    case 'dashboard':
      return <LayoutDashboard {...props} />;
    case 'pos':
      return <ShoppingCart {...props} />;
    case 'shifts':
      return <Clock {...props} />;
    case 'products':
      return <Package {...props} />;
    case 'categories':
      return <Tags {...props} />;
    case 'inventory':
      return <Boxes {...props} />;
    case 'sales':
      return <Receipt {...props} />;
    case 'customers':
      return <Users {...props} />;
    case 'expenses':
      return <Wallet {...props} />;
    case 'reports':
      return <BarChart3 {...props} />;
    case 'users':
      return <UserCog {...props} />;
    case 'settings':
      return <Settings {...props} />;
    default:
      return <Package {...props} />;
  }
}

export function PaymentMethodIcon({
  method,
  size = 15,
}: {
  method: string;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.75 };
  switch (method) {
    case 'CASH':
      return <Banknote {...props} />;
    case 'CARD':
      return <CreditCard {...props} />;
    case 'MOBILE_BANKING':
      return <Smartphone {...props} />;
    case 'CREDIT':
      return <FileSpreadsheet {...props} />;
    case 'SPLIT':
      return <Split {...props} />;
    default:
      return <Banknote {...props} />;
  }
}

export function StockMovementIcon({
  type,
  size = 14,
}: {
  type: string;
  size?: number;
}) {
  const props = { size, strokeWidth: 1.75 };
  switch (type) {
    case 'IN':
      return <ArrowDownToLine {...props} />;
    case 'OUT':
      return <ArrowUpFromLine {...props} />;
    case 'ADJUSTMENT':
      return <SlidersHorizontal {...props} />;
    case 'RETURN':
      return <RotateCcw {...props} />;
    default:
      return <Package {...props} />;
  }
}

/**
 * Clean enterprise monogram badge for products without an uploaded photo
 * (replaces cartoon food emojis).
 */
export function ProductMonogram({
  name,
  size = 36,
}: {
  name: string;
  size?: number;
}) {
  const initials = (name || 'PR')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        color: 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(11, Math.round(size * 0.34)),
        fontWeight: 600,
        letterSpacing: '0.03em',
        fontFamily: 'var(--font-en)',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials || <Package size={Math.round(size * 0.45)} strokeWidth={1.75} />}
    </div>
  );
}
