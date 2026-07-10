'use client'
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Environment, Text } from '@react-three/drei'
import * as THREE from 'three'

const ROOM_COLORS: Record<string, string> = {
  living_room: '#e2e8f0',
  bedroom_master: '#ede9fe',
  bedroom_2: '#fce7f3',
  kitchen: '#fef3c7',
  bathroom: '#e0f2fe',
  balcony: '#dcfce7',
  dining_room: '#fff7ed',
}

const FURNITURE_BY_ROOM: Record<string, { pos: [number, number, number]; size: [number, number, number]; color: string; label: string }[]> = {
  living_room: [
    { pos: [0, 0.3, 1.5], size: [1.8, 0.6, 0.8], color: '#94a3b8', label: 'Sofa' },
    { pos: [0, 0.15, -0.5], size: [0.8, 0.3, 0.8], color: '#cbd5e1', label: 'Coffee Table' },
    { pos: [-2, 0.5, -1.5], size: [1.2, 1.0, 0.1], color: '#1e293b', label: 'TV Unit' },
  ],
  bedroom_master: [
    { pos: [0, 0.35, 1.2], size: [1.6, 0.7, 2.0], color: '#a78bfa', label: 'King Bed' },
    { pos: [1.4, 0.3, 1.2], size: [0.4, 0.6, 0.4], color: '#c4b5fd', label: 'Bedside' },
    { pos: [-1.4, 0.3, 1.2], size: [0.4, 0.6, 0.4], color: '#c4b5fd', label: 'Bedside' },
    { pos: [0, 1.0, -1.8], size: [1.8, 2.0, 0.1], color: '#be185d', label: 'Wardrobe' },
  ],
  kitchen: [
    { pos: [-2, 0.6, 0], size: [0.6, 1.2, 2.0], color: '#fcd34d', label: 'Counter' },
    { pos: [-2, 1.5, 0], size: [0.6, 0.6, 2.0], color: '#fde68a', label: 'Overhead' },
  ],
  bathroom: [
    { pos: [-1.2, 0.5, 1], size: [0.7, 1.0, 0.5], color: '#7dd3fc', label: 'Vanity' },
    { pos: [1, 0.3, 1.5], size: [0.7, 0.6, 0.7], color: '#bae6fd', label: 'WC' },
  ],
  bedroom_2: [
    { pos: [0, 0.3, 1.2], size: [1.4, 0.6, 1.8], color: '#f9a8d4', label: 'Bed' },
    { pos: [1.2, 0.9, -1.5], size: [1.4, 1.8, 0.1], color: '#e879f9', label: 'Wardrobe' },
  ],
  balcony: [
    { pos: [0, 0.35, 0.3], size: [1.0, 0.7, 0.7], color: '#86efac', label: 'Sofa' },
    { pos: [0, 0.2, -0.7], size: [0.6, 0.4, 0.6], color: '#bbf7d0', label: 'Table' },
  ],
}

function Room({ roomType, wallColor }: { roomType: string; wallColor: string }) {
  const floorColor = ROOM_COLORS[roomType] || '#f1f5f9'
  const wallCol = wallColor || '#ffffff'
  const furniture = FURNITURE_BY_ROOM[roomType] || FURNITURE_BY_ROOM.living_room

  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color={floorColor} roughness={0.8} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, 1.5, -3]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-3, 1.5, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[3, 1.5, 0]}>
        <planeGeometry args={[6, 3]} />
        <meshStandardMaterial color={wallCol} roughness={0.9} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial color="#f8fafc" roughness={1} />
      </mesh>

      {/* Furniture */}
      {furniture.map((item, i) => (
        <group key={i} position={item.pos}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={item.size} />
            <meshStandardMaterial color={item.color} roughness={0.6} metalness={0.1} />
          </mesh>
          <Text
            position={[0, item.size[1] / 2 + 0.15, 0]}
            fontSize={0.12}
            color="#475569"
            anchorX="center"
            anchorY="bottom"
          >
            {item.label}
          </Text>
        </group>
      ))}
    </group>
  )
}

interface Props {
  roomType: string
  wallColor?: string
  style?: string
}

export default function RoomCanvas3D({ roomType, wallColor = '#ffffff', style }: Props) {
  return (
    <Canvas
      camera={{ position: [4, 3, 5], fov: 50 }}
      shadows
      style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' }}
    >
      <ambientLight intensity={0.6} />
      <directionalLight position={[3, 5, 3]} intensity={0.8} castShadow />
      <pointLight position={[0, 2.5, 0]} intensity={0.3} color="#fffbeb" />

      <Room roomType={roomType} wallColor={wallColor} />

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
}
