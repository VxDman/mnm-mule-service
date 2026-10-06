export type UserRole = 'admin' | 'runner';

export interface User {
  id: string;
  username: string;
  display_name: string;
  role: UserRole;
  created_at: string;
}

export interface UserWithPassword extends User {
  password_hash: string;
}

export interface Item {
  id: string;
  name: string;
  category: string;
  vendor_price_copper: number;
  stack_size: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'pending_quote' // Has unpriced items, waiting for runner quote
  | 'quoted'        // All items priced, ready for a runner to claim
  | 'accepted'      // Runner accepted and en route
  | 'arrived'       // Runner arrived at camp
  | 'completed'     // Trade completed
  | 'cancelled';    // Cancelled

export interface OrderItem {
  id: string;
  order_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  vendor_unit_copper: number;
  payout_unit_copper: number;
  is_priced: number; // 1 or 0
  notes?: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  event_type: string;
  actor_name: string;
  message: string;
  created_at: string;
}

export interface Order {
  id: string;
  customer_name: string;
  customer_token: string;
  zone: string;
  camp_location: string;
  customer_notes?: string;
  status: OrderStatus;
  payout_percent: number;
  total_vendor_copper: number;
  total_payout_copper: number;
  assigned_runner_id: string | null;
  assigned_runner_name: string | null;
  runner_eta: string | null;
  runner_notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  events?: OrderEvent[];
}

export interface AppSettings {
  guild_name: string;
  guild_tag: string;
  default_payout_percent: number;
  motd: string;
}
