import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FREE_DOC_LIMIT } from './doc-types';
import type { DocType, ExtractedField, StoredDocument, Task, TaskDraft } from './types';

/**
 * 書類とやることを端末の中に保存する。
 * TODO(暗号化): 企画書の「保存時の暗号化」は、AIとサーバーをつなぐ段階で expo-secure-store の鍵による暗号化に置き換える。
 */
export type Plan = 'free' | 'paid';

type State = { documents: StoredDocument[]; tasks: Task[]; plan: Plan };

const STORAGE_KEY = 'shorui-app/state/v1';
const EMPTY: State = { documents: [], tasks: [], plan: 'free' };

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

type NewDocument = {
  type: DocType;
  title: string;
  counterparty: string | null;
  text: string;
  fields: ExtractedField[];
  tasks: TaskDraft[];
};

type Store = State & {
  loaded: boolean;
  canAddDocument: boolean;
  addDocument(doc: NewDocument): string;
  deleteDocument(id: string): void;
  updateTask(id: string, patch: Partial<Pick<Task, 'dueDate' | 'registered' | 'done' | 'notify'>>): void;
  setPlan(plan: Plan): void;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) setState({ ...EMPTY, ...(JSON.parse(raw) as State) });
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const addDocument = useCallback((doc: NewDocument) => {
    const id = newId();
    setState((s) => ({
      ...s,
      documents: [
        { id, type: doc.type, title: doc.title, counterparty: doc.counterparty, text: doc.text, fields: doc.fields, createdAt: new Date().toISOString() },
        ...s.documents,
      ],
      tasks: [...s.tasks, ...doc.tasks.map((t) => ({ ...t, id: newId(), docId: id, registered: false }))],
    }));
    return id;
  }, []);

  const deleteDocument = useCallback((id: string) => {
    setState((s) => ({ ...s, documents: s.documents.filter((d) => d.id !== id), tasks: s.tasks.filter((t) => t.docId !== id) }));
  }, []);

  const updateTask = useCallback<Store['updateTask']>((id, patch) => {
    setState((s) => ({ ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  }, []);

  const setPlan = useCallback((plan: Plan) => setState((s) => ({ ...s, plan })), []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      loaded,
      canAddDocument: state.plan === 'paid' || state.documents.length < FREE_DOC_LIMIT,
      addDocument,
      deleteDocument,
      updateTask,
      setPlan,
    }),
    [state, loaded, addDocument, deleteDocument, updateTask, setPlan],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('StoreProvider がありません');
  return s;
}

/** 同じ相手先・同じ種類の書類を古い順に並べる（履歴） */
export function historyOf(documents: StoredDocument[], doc: StoredDocument): StoredDocument[] {
  if (!doc.counterparty) return [doc];
  return documents
    .filter((d) => d.type === doc.type && d.counterparty === doc.counterparty)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}
