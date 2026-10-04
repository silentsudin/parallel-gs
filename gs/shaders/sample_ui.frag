// SPDX-License-Identifier: LGPL-3.0+
// UI mask scanout (Road Trip recomp): 1 where the displayed pixel's last colour write came from
// the UI (HUD, 2D screens), read from the UI mask buffer at the frame buffer address (DISPFB).

#version 450

#extension GL_EXT_shader_16bit_storage : require
#include "data_structures.h"
#include "swizzle_utils.h"
#include "utils.h"

layout(location = 0) out vec4 FragMask;

layout(set = 0, binding = 0) readonly buffer UiMask
{
    uint data[];
} ui_mask;

layout(push_constant) uniform Registers
{
    uint fbp;
    uint fbw;
    uint dbx;
    uint dby;
    uint phase;
    uint phase_stride;
} registers;

layout(constant_id = 0) const int PSM = PSMCT32;
layout(constant_id = 1) const uint VRAM_MASK = 4 * 1024 * 1024 - 1;
layout(constant_id = 2) const uint SUPER_SAMPLES = 1;

void main()
{
    uvec2 super_sampled_coord = uvec2(gl_FragCoord.xy);
    uvec2 single_sampled_coord = SUPER_SAMPLES >= 4 ? (super_sampled_coord >> 1) : super_sampled_coord;
    uvec2 coord = single_sampled_coord * uvec2(1u, registers.phase_stride) +
        uvec2(registers.dbx, registers.dby + registers.phase);
    uint addr = swizzle_PS2(coord.x, coord.y, registers.fbp * PGS_BLOCKS_PER_PAGE, registers.fbw, PSM, VRAM_MASK);
    FragMask = vec4(float(ui_mask.data[addr] != 0u), 0.0, 0.0, 1.0);
}
