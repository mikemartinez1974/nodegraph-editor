import React, { createContext, useContext } from 'react';

const GraphEditorStateContext = createContext(null);
const GraphEditorHistoryContext = createContext(null);
const GraphEditorRpcContext = createContext(null);
const GraphEditorLayoutContext = createContext(null);
const GraphEditorServicesContext = createContext(null);

export function GraphEditorContextProvider({
  state,
  history,
  rpc,
  layout,
  services,
  children
}) {
  return (
    <GraphEditorStateContext.Provider value={state}>
      <GraphEditorHistoryContext.Provider value={history}>
        <GraphEditorRpcContext.Provider value={rpc}>
          <GraphEditorLayoutContext.Provider value={layout}>
            <GraphEditorServicesContext.Provider value={services}>
              {children}
            </GraphEditorServicesContext.Provider>
          </GraphEditorLayoutContext.Provider>
        </GraphEditorRpcContext.Provider>
      </GraphEditorHistoryContext.Provider>
    </GraphEditorStateContext.Provider>
  );
}

function createGuardedHook(context, name) {
  return function useGuarded() {
    const value = useContext(context);
    if (!value) {
      throw new Error(`${name} must be used within a GraphEditorContextProvider`);
    }
    return value;
  };
}

export const useGraphEditorStateContext = createGuardedHook(
  GraphEditorStateContext,
  'useGraphEditorStateContext'
);

export const useGraphEditorHistoryContext = createGuardedHook(
  GraphEditorHistoryContext,
  'useGraphEditorHistoryContext'
);

export const useGraphEditorRpcContext = createGuardedHook(
  GraphEditorRpcContext,
  'useGraphEditorRpcContext'
);

export const useGraphEditorLayoutContext = createGuardedHook(
  GraphEditorLayoutContext,
  'useGraphEditorLayoutContext'
);

export const useGraphEditorServicesContext = createGuardedHook(
  GraphEditorServicesContext,
  'useGraphEditorServicesContext'
);

export {
  GraphEditorStateContext,
  GraphEditorHistoryContext,
  GraphEditorRpcContext,
  GraphEditorLayoutContext,
  GraphEditorServicesContext
};
