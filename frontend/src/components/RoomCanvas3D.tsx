'use client'
import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Environment, Text, RoundedBox } from '@react-three/drei'

// Floor color per room type
const ROOM_FLOOR_COLORS: Record<string, string> = {
  living_room:     '#d4c5b0',
  bedroom_master:  '#c4b5fd',
  bedroom_2:       '#f9a8d4',
  bedroom_3:       '#fca5a5',
  bedroom_4:       '#a5f3fc',
  kitchen:         '#fde68a',
  bathroom:        '#7dd3fc',
  balcony:         '#86efac',
  dining_room:     '#fdba74',
  home_office:     '#93c5fd',
}

// Category -> 3D shape config
const CATEGORY_CONFIG: Record<string, {
  size: [number, number, number]
  color: string
  yOffset?: number
  shape?: 'box' | 'flat' | 'tall' | 'wide'
}> = {
  sofa:           { size: [1.8, 0.65, 0.8],  color: '#4f46e5', shape: 'box' },
  chair:          { size: [0.65, 0.85, 0.65], color: '#7c3aed', shape: 'box' },
  table:          { size: [1.2, 0.35, 0.8],  color: '#6d28d9', shape: 'flat' },
  coffee_table:   { size: [0.9, 0.3, 0.55],  color: '#8b5cf6', shape: 'flat' },
  dining_table:   { size: [1.6, 0.75, 0.9],  color: '#7c3aed', shape: 'flat' },
  bed:            { size: [1.6, 0.5, 2.0],   color: '#6366f1', shape: 'box' },
  wardrobe:       { size: [1.8, 2.0, 0.5],   color: '#4338ca', shape: 'tall' },
  bookshelf:      { size: [0.9, 1.8, 0.35],  color: '#3730a3', shape: 'tall' },
  tv_unit:        { size: [1.4, 0.45, 0.4],  color: '#1e293b', shape: 'wide' },
  cabinet:        { size: [0.8, 1.1, 0.4],   color: '#475569', shape: 'tall' },
  storage:        { size: [0.7, 1.0, 0.45],  color: '#64748b', shape: 'box' },
  lighting:       { size: [0.3, 0.12, 0.3],  color: '#fbbf24', shape: 'flat', yOffset: 2.6 },
  rug:            { size: [2.0, 0.03, 1.4],  color: '#a78bfa', shape: 'flat', yOffset: 0.02 },
  curtain:        { size: [0.08, 2.2, 1.8],  color: '#ddd6fe', shape: 'tall', yOffset: 1.1 },
  counter:        { size: [0.6, 0.9, 2.0],   color: '#fcd34d', shape: 'box' },
  vanity:         { size: [0.7, 0.9, 0.5],   color: '#7dd3fc', shape: 'box' },
  appliance:      { size: [0.6, 0.7, 0.6],   color: '#94a3b8', shape: 'box' },
  default:        { size: [1.0, 0.8, 0.7],   color: '#6366f1', shape: 'box' },
}

// Default furniture layouts per room type (used when no items selected)
const DEFAULT_FURNITURE: Record<string, { pos: [number,number,number]; size: [number,number,number]; color: string; label: string }[]> = {
  living_room: [
    { pos: [0, 0.33, 1.4],  size: [1.8, 0.65, 0.8], color: '#4f46e5', label: 'Sofa' },
    { pos: [0, 0.15, -0.5], size: [0.85, 0.3, 0.6],  color: '#818cf8', label: 'Coffee Table' },
    { pos: [-2, 0.25, -1.5],size: [1.2, 0.5, 0.1],   color: '#1e293b', label: 'TV Unit' },
  ],
  bedroom_master: [
    { pos: [0, 0.28, 1.2],   size: [1.6, 0.55, 2.0], color: '#6366f1', label: 'King Bed' },
    { pos: [1.3, 0.3, 1.2],  size: [0.4, 0.6, 0.4],  color: '#a5b4fc', label: 'Bedside' },
    { pos: [-1.3, 0.3, 1.2], size: [0.4, 0.6, 0.4],  color: '#a5b4fc', label: 'Bedside' },
    { pos: [0, 1.0, -1.9],   size: [1.8, 2.0, 0.08], color: '#3730a3', label: 'Wardrobe' },
  ],
  kitchen: [
    { pos: [-2, 0.5, 0], size: [0.6, 0.9, 2.0], color: '#fcd34d', label: 'Counter' },
    { pos: [-2, 1.5, 0], size: [0.6, 0.5, 2.0], color: '#fde68a', label: 'Overhead' },
  ],
  bathroom: [
    { pos: [-1.2, 0.5, 1],  size: [0.7, 0.95, 0.5], color: '#7dd3fc', label: 'Vanity' },
    { pos: [1, 0.3, 1.5],   size: [0.7, 0.6, 0.7],  color: '#bae6fd', label: 'WC' },
  ],
  bedroom_2: [
    { pos: [0, 0.28, 1.2],  size: [1.4, 0.55, 1.8], color: '#ec4899', label: 'Bed' },
    { pos: [1.2, 0.9, -1.5],size: [1.4, 1.8, 0.08], color: '#db2777', label: 'Wardrobe' },
  ],
  balcony: [
    { pos: [0, 0.35, 0.3],  size: [1.0, 0.7, 0.7], color: '#22c55e', label: 'Sofa' },
    { pos: [0, 0.2, -0.6],  size: [0.6, 0.4, 0.6], color: '#86efac', label: 'Table' },
  ],
  dining_room: [
    { pos: [0, 0.38, 0],    size: [1.6, 0.75, 0.9], color: '#7c3aed', label: 'Dining Table' },
    { pos: [1.2, 0.42, 0],  size: [0.5, 0.85, 0.5], color: '#a78bfa', label: 'Chair' },
    { pos: [-1.2, 0.42, 0], size: [0.5, 0.85, 0.5], color: '#a78bfa', label: 'Chair' },
  ],
}

function getCategoryConfig(category?: string, name?: string) {
  if (!category && !name) return CATEGORY_CONFIG.default
  const cat = (category || '').toLowerCase().replace(/[_\s-]/g, '_')
  const nameLower = (name || '').toLowerCase()
  
  // Try direct match
  if (CATEGORY_CONFIG[cat]) return CATEGORY_CONFIG[cat]
  
  // Fuzzy match by keywords in category or name
  const combined = `${cat} ${nameLower}`
  if (combined.includes('sofa') || combined.includes('couch')) return CATEGORY_CONFIG.sofa
  if (combined.includes('chair') || combined.includes('seat')) return CATEGORY_CONFIG.chair
  if (combined.includes('bed') && !combined.includes('bedside')) return CATEGORY_CONFIG.bed
  if (combined.includes('wardrobe') || combined.includes('closet') || combined.includes('almirah')) return CATEGORY_CONFIG.wardrobe
  if (combined.includes('tv') || combined.includes('television') || combined.includes('entertainment')) return CATEGORY_CONFIG.tv_unit
  if (combined.includes('coffee') || combined.includes('center table')) return CATEGORY_CONFIG.coffee_table
  if (combined.includes('dining table')) return CATEGORY_CONFIG.dining_table
  if (combined.includes('table') || combined.includes('desk')) return CATEGORY_CONFIG.table
  if (combined.includes('shelf') || combined.includes('bookcase') || combined.includes('rack')) return CATEGORY_CONFIG.bookshelf
  if (combined.includes('cabinet') || combined.includes('drawer')) return CATEGORY_CONFIG.cabinet
  if (combined.includes('light') || combined.includes('lamp') || combined.includes('chandelier')) return CATEGORY_CONFIG.lighting
  if (combined.includes('rug') || combined.includes('carpet') || combined.includes('mat')) return CATEGORY_CONFIG.rug
  if (combined.includes('curtain') || combined.includes('blind') || combined.includes('drape')) return CATEGORY_CONFIG.curtain
  if (combined.includes('counter') || combined.includes('kitchen')) return CATEGORY_CONFIG.counter
  if (combined.includes('vanity') || combined.includes('bathroom')) return CATEGORY_CONFIG.vanity
  if (combined.includes('appliance') || combined.includes('fridge') || combined.includes('washing')) return CATEGORY_CONFIG.appliance
  
  return CATEGORY_CONFIG.default
}

function FurnitureItem({ item, index, totalItems }: {
  item: { pos?: [number,number,number]; size?: [number,number,number]; color?: string; label: string; category?: string; name?: string }
  index: number
  totalItems: number
}) {
  const config = item.pos
    ? { size: item.size!, color: item.color! }
    : getCategoryConfig(item.category, item.name || item.label)

  const size = item.size || config.size
  const color = item.color || config.color
  const yOff = (config as any).yOffset

  // Calculate auto position if no pos given
  let pos: [number, number, number] = item.pos as [number, number, number]
  if (!pos) {
    const cols = Math.min(3, totalItems)
    const col = index % cols
    const row = Math.floor(index / cols)
    const x = -1.5 + col * 1.5
    const z = -1.2 + row * 1.6
    const y = yOff !== undefined ? yOff : size[1] / 2
    pos = [x, y, z]
  }

  return (
    <group position={pos}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.5} metalness={0.08} />
      </mesh>
      <Text
        position={[0, size[1] / 2 + 0.14, 0]}
        fontSize={0.11}
        color="#e2e8f0"
        anchorX="center"
        anchorY="bottom"
        maxWidth={1.5}
        textAlign="center"
        outlineWidth={0.01}
        outlineColor="#1e1b4b"
      >
        {item.label}
      </Text>
    </group>
  )
}

function Room({ roomType, wallColor, roomItems, allProducts }: {
  roomType: string
  wallColor: string
  roomItems?: any[]   // items from the room (backend RoomItem with product)
  allProducts?: any[] // catalog products
}) {
  const floorColor = ROOM_FLOOR_COLORS[roomType] || '#e2e8f0'
  const wallCol = wallColor || '#f8fafc'

  // Build furniture list
  let furnitureList: any[] = []

  if (roomItems && roomItems.length > 0) {
    // Use actual room items
    furnitureList = roomItems.map((item: any, i: number) => {
      const product = item.product || allProducts?.find((p: any) => p.id === item.product_id) || {}
      return {
        label: product.name || item.item_name || 'Item',
        category: product.category || '',
        name: product.name || '',
      }
    })
  } else {
    // Use default layout furniture
    furnitureList = (DEFAULT_FURNITURE[roomType] || DEFAULT_FURNITURE.living_room).map(f => ({
      ...f,
      pos: f.pos,
      size: f.size,
      color: f.color,
      label: f.label,
    }))
  }

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1.5, -3]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 1.5, 0]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[3, 1.5, 0]} receiveShadow>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={1} />
      </mesh>

      {/* Floor skirting lines */}
      {[-3, 3].map((x, i) => (
        <mesh key={i} position={[x, 0.04, 0]}>
          <boxGeometry args={[0.06, 0.08, 6]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      ))}

      {/* Furniture */}
      {furnitureList.map((item: any, i: number) => (
        <FurnitureItem key={i} item={item} index={i} totalItems={furnitureList.length} />
      ))}
    </group>
  )
}

// Sub-component that captures WebGL renderer for screenshots
function ScreenshotCapture({ onReady }: { onReady: (fn: () => string) => void }) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    onReady(() => {
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
  }, [camera, gl, onReady, scene])
  return null
}

export interface RoomCanvas3DRef {
  takeScreenshot: () => string | null
}

interface Props {
  roomType: string
  wallColor?: string
  style?: string
  selectedProducts?: string[]  // legacy: array of product IDs
  allProducts?: any[]          // legacy: all catalog products
  roomItems?: any[]            // actual room items from backend
}

const RoomCanvas3D = forwardRef<RoomCanvas3DRef, Props>(function RoomCanvas3D(
  { roomType, wallColor = '#f8fafc', style, selectedProducts = [], allProducts = [], roomItems },
  ref
) {
  const screenshotFnRef = useRef<(() => string) | null>(null)

  useImperativeHandle(ref, () => ({
    takeScreenshot: () => {
      if (screenshotFnRef.current) {
        try { return screenshotFnRef.current() }
        catch { return null }
      }
      return null
    }
  }))

  // Convert legacy selectedProducts array to roomItems format for rendering
  const effectiveRoomItems = roomItems || (
    selectedProducts.length > 0
      ? selectedProducts.map(pid => {
          const product = allProducts.find((p: any) => p.id === pid)
          return { product_id: pid, product }
        })
      : []
  )

  return (
    <Canvas
      camera={{ position: [4, 3, 5], fov: 50 }}
      shadows
      gl={{ preserveDrawingBuffer: true }}
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}
    >
      <ambientLight intensity={0.65} />
      <directionalLight position={[3, 5, 3]} intensity={0.85} castShadow shadow-mapSize={[1024, 1024]} />
      <pointLight position={[0, 2.5, 0]} intensity={0.35} color="#fffbeb" />
      <pointLight position={[0, 2.5, 2]} intensity={0.2} color="#e0e7ff" />

      <ScreenshotCapture onReady={(fn) => { screenshotFnRef.current = fn }} />

      <Room
        roomType={roomType}
        wallColor={wallColor}
        roomItems={effectiveRoomItems}
        allProducts={allProducts}
      />

      <OrbitControls
        enablePan={false}
        minDistance={3}
        maxDistance={9}
        maxPolarAngle={Math.PI / 2.1}
        target={[0, 1.2, 0]}
      />
      <Environment preset="city" />
    </Canvas>
  )
})

export default RoomCanvas3D
