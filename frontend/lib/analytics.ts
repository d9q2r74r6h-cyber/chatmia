import { supabase } from './supabase';

export async function trackEvent(
  eventName: string,
  metadata: any = {}
) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('events').insert({
      user_email: user?.email || 'anonymous',
      event_name: eventName,
      metadata,
    });
  } catch (error) {
    console.error('Analytics error:', error);
  }
}