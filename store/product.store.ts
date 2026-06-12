import { create } from 'zustand'

interface ProductState {
  selectedProductId: string | null
  selectedProductName: string | null
  setSelectedProduct: (id: string | null, name?: string | null) => void
}

const getInitialState = () => {
  if (typeof window === 'undefined') return { selectedProductId: null, selectedProductName: null }
  try {
    const id = localStorage.getItem('selectedProductId')
    const name = localStorage.getItem('selectedProductName')
    return { selectedProductId: id, selectedProductName: name }
  } catch {
    return { selectedProductId: null, selectedProductName: null }
  }
}

export const useProductStore = create<ProductState>((set) => ({
  ...getInitialState(),
  setSelectedProduct: (id, name = null) => {
    try {
      if (id) {
        localStorage.setItem('selectedProductId', id)
        if (name) localStorage.setItem('selectedProductName', name)
        else localStorage.removeItem('selectedProductName')
      } else {
        localStorage.removeItem('selectedProductId')
        localStorage.removeItem('selectedProductName')
      }
    } catch {
      // localStorage unavailable
    }
    set({ selectedProductId: id, selectedProductName: name })
  },
}))
