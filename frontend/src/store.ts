// src/store.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Shared defaults for non-auth transient app state to avoid repetition
const nonAuthDefaults = {
  // Sticky Notes State
  stickyNotes: [],

  // Form Sharing State
  publicForms: [],
  shareModalVisible: false,
  importModalVisible: false,
  currentShareCode: null,
  currentShareExpires: null,
  shareFormId: null,
  isLoadingSharedForms: false,

  // Cases State
  currentCase: null,
  currentCaseID: null,
  cases: [],

  // Presentation state (transient)
  presentationId: null,
  renderedPageID: "welcome",
  previousPageID: "",

  // Outline streaming state
  outlines: [],

  // Sidebar state
  collapsed: false,

  // Footer state
  footerContent: null,

  // Selected slide template ID
  selectedSlideTemplateId: null,
};

const useStore = create(
  persist(
    (set, get) => ({
      // Auth State
      token: null,
      isAuthenticated: false,
      user: null,

      // Auth Actions
      setAuth: ({ token, user }) => {
        // When setting auth (on login), reset transient app state to defaults
        // to avoid carrying over stale UI/navigation state from a previous session.
        set({
          token,
          user,
          isAuthenticated: !!token,
          ...nonAuthDefaults,
        });
      },
      logout: () => {
        set({
          token: null,
          isAuthenticated: false,
          user: null,
          ...nonAuthDefaults,
        });
      },

      // Reset only the non-auth default parts of the state (useful if you want to
      // clear UI/navigation while preserving the current auth token/user)
      resetToDefaults: () =>
        set((state) => ({
          ...nonAuthDefaults,
          // preserve auth when resetting
          token: state.token,
          user: state.user,
          isAuthenticated: state.isAuthenticated,
        })),
      setUser: (user) => set({ user }),

      // include non-auth defaults in root so hooks can read them directly
      ...nonAuthDefaults,

      // Actions to manipulate sticky notes
      addStickyNote: (note) =>
        set((state) => ({ stickyNotes: [...state.stickyNotes, note] })),

      setStickyNotes: (notes) => set({ stickyNotes: notes }),

      removeStickyNote: (id) =>
        set((state) => ({
          stickyNotes: state.stickyNotes.filter((note) => note.id !== id),
        })),

      updateStickyNote: (updatedNote) =>
        set((state) => ({
          stickyNotes: state.stickyNotes.map((note) =>
            note.id === updatedNote.id ? updatedNote : note
          ),
        })),

      clearStickyNotes: () => set({ stickyNotes: [] }),

      // Form Sharing Actions
      setPublicForms: (forms) => set({ publicForms: forms }),
      setShareModalVisible: (visible) => set({ shareModalVisible: visible }),
      setImportModalVisible: (visible) => set({ importModalVisible: visible }),
      setCurrentShareCode: (code, expires, formId) =>
        set({
          currentShareCode: code,
          currentShareExpires: expires,
          shareFormId: formId,
        }),
      setIsLoadingSharedForms: (loading) =>
        set({ isLoadingSharedForms: loading }),
      clearShareData: () =>
        set({
          currentShareCode: null,
          currentShareExpires: null,
          shareFormId: null,
        }),

      // Actions to manipulate cases
      setCurrentCase: (caseData) => set({ currentCase: caseData }),
      setCurrentCaseID: (id) => set({ currentCaseID: id }),
      setCases: (cases) => set({ cases }),

      // Presentation actions
      setPresentationId: (id) =>
        set((state) => ({
          presentationId: id,
          // Clear outlines when setting a new presentation ID to avoid stale data
          outlines: [],
        })),
      clearPresentationId: () => set({ presentationId: null }),

      // Outline streaming actions
      setOutlines: (outlines) => set({ outlines }),
      clearOutlines: () => set({ outlines: [] }),

      // Sidebar actions
      setCollapsed: (collapsed) => set({ collapsed }),

      // Footer actions
      setFooterContent: (content, isSticky = false) =>
        set({ footerContent: content ? { content, isSticky } : null }),

      addCase: (newCase) =>
        set((state) => ({ cases: [...state.cases, newCase] })),

      updateCase: (updatedCase) =>
        set((state) => ({
          cases: state.cases.map((c) =>
            c.id === updatedCase.id ? updatedCase : c
          ),
        })),

      deleteCaseById: (id) =>
        set((state) => ({
          cases: state.cases.filter((c) => c.id !== id),
        })),

      clearCases: () => set({ cases: [] }),

      // Selected slide template actions
      setSelectedSlideTemplateId: (id) => set({ selectedSlideTemplateId: id }),

      // reset calls logout which clears everything
      reset: () => get().logout(),
    }),
    {
      name: "notescribe",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      migrate: (persistedState, version) => {
        if (version < 2) {
          // Initialize new auth fields if they don't exist in old state
          return {
            ...persistedState,
            token: persistedState.token || null,
            isAuthenticated: persistedState.isAuthenticated || false,
            user: persistedState.user || null,
          };
        }
        return persistedState;
      },
      // Avoid persisting transient UI state like modal visibility
      partialize: (state) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) =>
              ![
                "shareModalVisible",
                "importModalVisible",
                "isLoadingSharedForms",
                "presentationId",
                "outlines",
                "footerContent",
                "selectedSlideTemplateId",
              ].includes(key)
          )
        ),
    }
  )
);

export default useStore;
