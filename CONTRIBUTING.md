# Contributing to IdleTrencher

Thank you for your interest in contributing! This guide explains how to add new characters and assets to the game.

## Adding New Characters

### File Requirements

Characters are 3D models in GLB format with embedded animations.

**Location:** `frontend/public/assets/characters/`

**Required Animations:**
Each character needs 5 animation variants:
- `{CharacterName}_Cheer_withSkin.glb`
- `{CharacterName}_Running_withSkin.glb`
- `{CharacterName}_Walking_withSkin.glb`
- `{CharacterName}_Talk_withSkin.glb`
- `{CharacterName}_Situps_withSkin.glb`

**File Size Guidelines:**
- Each GLB file should be under 500KB
- Use Draco compression if possible
- Optimize mesh complexity (< 5000 triangles per character)

### Updating assets.json

After adding character files, update `frontend/public/assets.json`:

```json
{
  "characters": [
    "Villager",
    "Adventurer",
    "Knight",
    "Mage",
    "YourNewCharacter"  // Add here
  ],
  "animations": ["Cheer", "Running", "Walking", "Talk", "Situps"]
}
```

### Character Design Guidelines

- **Style:** Low-poly, stylized (matching existing characters)
- **Rigging:** Humanoid skeleton compatible with existing animations
- **Colors:** Bright, distinguishable colors
- **Theme:** Fantasy/RPG aesthetic

## Adding Environment Assets

**Location:** `frontend/public/assets/environment/`

Environment assets are static GLTF files:
- Trees, bushes, rocks, decorations
- Should be under 100KB each
- No animations required

## Pull Request Process

1. **Fork** the repository
2. **Create a branch** for your contribution
3. **Add your assets** following the guidelines above
4. **Test locally** with `npm run dev` in the frontend directory
5. **Submit PR** with:
   - Description of the new character/asset
   - Preview image or GIF (optional but appreciated)
   - Confirmation that files meet size requirements

## Code Contributions

For code contributions (bug fixes, features):

1. Check existing issues first
2. For new features, open an issue to discuss before implementing
3. Follow existing code style
4. Test your changes locally
5. Keep PRs focused and minimal

## Questions?

Open an issue with the `question` label if you need help!
