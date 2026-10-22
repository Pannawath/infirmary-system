'use client';
import {useEffect} from 'react';
import {installInteractionGuards} from '@/lib/interaction-guards';

export default function InteractionGuards() {
  useEffect(() => installInteractionGuards(document), []);
  return null;
}
