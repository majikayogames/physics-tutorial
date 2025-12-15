from manim import *

class AnalyticGravityV3(Scene):
	def construct(self):
		"""
		Design goals:
		- Clear lanes: (A) main equation band, (B) bottom caption bar, (C) corner rule cards.
		- Smooth continuity: TransformMatchingTex with consistent tokenization.
		- Gentle motion: slide-in for integrals; morph terms instead of retyping.
		- Minimal chrome: subtle card outlines, no heavy strokes.
		- Legible: clamp equation width; modest font sizes; fixed anchors.
		"""

		# ---------- Layout anchors (no overlap) ----------
		eq_y = 0.0				# main equation baseline (exactly centered)
		caption_bar_h = 1.45
		EQ_FONT = 64			# single source of truth for equation font size

		# Bottom caption bar background
		caption_bar = Rectangle(
			width=config.frame_width,
			height=caption_bar_h,
			fill_color=BLACK,
			fill_opacity=0.85,
			stroke_opacity=0
		).to_edge(DOWN)
		self.add(caption_bar)

		# Stateful references
		caption = None
		current_eq = VGroup()

		# ---------- Helpers ----------
		def place_eq(mobj: Mobject):
			"""Center the equation horizontally, lock it to eq_y, clamp width."""
			mobj.move_to(np.array([0, eq_y, 0]))
			mobj.set_max_width(config.frame_width * 0.9)
			return mobj

		def show_caption(n: str, text: str):
			"""Numbered caption inside the bottom bar (replace-in-place)."""
			nonlocal caption
			num = Tex(rf"\textbf{{{n}.}}", font_size=34)
			body = Tex(text, font_size=32)
			line = VGroup(num, body).arrange(RIGHT, buff=0.28, aligned_edge=UP)
			line.move_to(caption_bar.get_center()).shift(0.03 * UP)
			if caption:
				self.play(FadeOut(caption), run_time=0.3)
				self.play(FadeIn(line), run_time=0.3)
			else:
				self.play(FadeIn(line), run_time=0.4)
			caption = line

		def power_rule_card():
			title_d = Tex(r"\textbf{Power rule (Derivative)}", font_size=28)
			eq_d = MathTex(r"\frac{d}{dx}x^n = n x^{\,n-1}", font_size=28)
			title_i = Tex(r"\textbf{Power rule backwards (Integral)}", font_size=28)
			eq_i = MathTex(r"\int x^n\,dx = \frac{x^{\,n+1}}{n+1} + C", font_size=28)
			stack = VGroup(title_d, eq_d, title_i, eq_i).arrange(DOWN, buff=0.16)
			box = RoundedRectangle(corner_radius=0.18, stroke_color=BLUE, stroke_opacity=0.35, fill_opacity=0).surround(stack, buff=0.4)
			return VGroup(stack, box).to_corner(UR).shift(0.35 * LEFT + 0.05 * DOWN)

		def sum_rule_card():
			title = Tex(r"\textbf{Sum rule}", font_size=28)
			eq = MathTex(r"\int\!\bigl(f+g\bigr)\,dt \;=\; \int f\,dt + \int g\,dt", font_size=28)
			stack = VGroup(title, eq).arrange(DOWN, buff=0.16)
			box = RoundedRectangle(corner_radius=0.18, stroke_color=BLUE, stroke_opacity=0.35, fill_opacity=0).surround(stack, buff=0.4)
			return VGroup(stack, box).to_corner(UR).shift(0.35 * LEFT + 0.05 * DOWN)

		def slide_in_integral(target_part: Mobject, run_time=0.6):
			"""Slide an integral from the left to the target position, then swap with the target glyph."""
			int_ghost = MathTex(r"\int", font_size=EQ_FONT)
			int_ghost.move_to(target_part.get_center() + 4 * LEFT)
			self.add(int_ghost)
			self.play(int_ghost.animate.move_to(target_part.get_center()), run_time=run_time, rate_func=smooth)
			self.play(ReplacementTransform(int_ghost, target_part), run_time=0.2)

		# ---------- Step 1: a(t) = g = -9.81 ----------
		eq1 = place_eq(MathTex(
			r"a(t) = g = -9.81",
			substrings_to_isolate=[r"a(t)", r"=", r"g", r"-9.81"],
			font_size=EQ_FONT
		))
		self.play(Write(eq1), run_time=1.2)
		current_eq = eq1
		show_caption("1", "Define constant acceleration due to gravity; starting differential equation.")

		# ---------- Step 2: v(t) = ∫ a(t) dt (a(t) slides over, integral slides in) ----------
		# Build the new equation first
		vt = place_eq(MathTex(
			r"v(t) = \int a(t)\,dt",
			substrings_to_isolate=[r"v(t)", r"=", r"\int", r"a(t)", r"dt"],
			font_size=EQ_FONT
		))
		
		# Fade out everything except a(t) from step 1
		a_piece = current_eq.get_part_by_tex("a(t)")
		other_parts = VGroup(
			current_eq.get_parts_by_tex("="),
			current_eq.get_part_by_tex("g"),
			current_eq.get_part_by_tex("-9.81")
		)
		
		self.play(
			FadeOut(other_parts, shift=0.2 * DOWN),
			run_time=0.5
		)
		
		# Bring in new components and transform a(t) to its new position
		self.play(
			FadeIn(vt.get_part_by_tex("v(t)"), shift=0.05 * UP),
			FadeIn(vt.get_parts_by_tex("=")),
			FadeIn(vt.get_part_by_tex(r"\int")),
			FadeIn(vt.get_part_by_tex("dt")),
			ReplacementTransform(a_piece, vt.get_part_by_tex("a(t)")),
			run_time=0.6
		)
		
		current_eq = vt
		show_caption("2", "Integrate acceleration with respect to time to obtain velocity.")

		# ---------- Step 3: substitute constant; integrate -9.81 ----------
		vt_const = place_eq(MathTex(
			r"v(t) = \int (-9.81)\,dt",
			substrings_to_isolate=[r"v(t)", r"=", r"\int", r"(-9.81)", r"dt"],
			font_size=EQ_FONT
		))
		self.play(TransformMatchingTex(current_eq, vt_const), run_time=0.7)
		current_eq = vt_const
		show_caption("3", "Substitute the constant acceleration; now we’re integrating $-9.81$ with respect to $t$.")

		# Power rule card (show at full, then dim later)
		card_power = power_rule_card()
		self.play(FadeIn(card_power, shift=0.15 * LEFT), run_time=0.4)

		# ---------- Step 4: integrate constant; +C appears ----------
		vt_int = place_eq(MathTex(
			r"v(t) = -9.81\,t + C",
			substrings_to_isolate=[r"v(t)", r"=", r"-9.81", r"t", r"+", r"C"],
			font_size=EQ_FONT
		))
		self.play(TransformMatchingTex(current_eq, vt_int), run_time=0.7)
		current_eq = vt_int
		show_caption("4", "Apply power rule backwards to a constant; get a linear term in $t$ and a $+C$ from integration.")

		# ---------- Step 5: C → v0 using initial condition ----------
		vt_v0 = place_eq(MathTex(
			r"v(t) = -9.81\,t + v_0",
			substrings_to_isolate=[r"v(t)", r"=", r"-9.81", r"t", r"+", r"v_0"],
			font_size=EQ_FONT
		))
		self.play(TransformMatchingTex(current_eq, vt_v0), run_time=0.6)
		current_eq = vt_v0
		show_caption("5", "Set $C = v_0$ because the constant is fixed by the initial condition $v(0)=v_0$.")
		self.play(FadeOut(card_power, shift=0.15 * RIGHT), run_time=0.3)

		# ---------- Step 6: x(t) = ∫ v(t) dt (fresh integral slides) ----------
		# First fade out the previous equation
		self.play(FadeOut(current_eq, shift=0.1 * DOWN), run_time=0.3)
		
		xt = place_eq(MathTex(
			r"x(t) = \int v(t)\,dt",
			substrings_to_isolate=[r"x(t)", r"=", r"\int", r"v(t)", r"dt"],
			font_size=EQ_FONT
		))
		# Bring in all components together
		self.play(
			FadeIn(xt.get_part_by_tex("x(t)"), shift=0.05 * UP),
			FadeIn(xt.get_parts_by_tex("=")),
			FadeIn(xt.get_part_by_tex(r"\int")),
			FadeIn(xt.get_part_by_tex("v(t)")),
			FadeIn(xt.get_part_by_tex("dt")),
			run_time=0.5
		)
		current_eq = xt
		show_caption("6", "Integrate velocity with respect to time to recover position.")

		# ---------- Step 7: expand integrand; sum rule + power rule ----------
		xt_exp = place_eq(MathTex(
			r"x(t) = \int \bigl(-9.81\,t + v_0\bigr)\,dt",
			substrings_to_isolate=[r"x(t)", r"=", r"\int", r"-9.81", r"t", r"v_0", r"dt"],
			font_size=EQ_FONT
		))
		self.play(TransformMatchingTex(current_eq, xt_exp), run_time=0.7)
		current_eq = xt_exp
		show_caption("7", "Use the sum rule to split terms; then apply the power rule backwards to each term separately.")
		card_sum = sum_rule_card()
		self.play(FadeIn(card_sum, shift=0.15 * LEFT), run_time=0.35)

		# ---------- Go directly to final form ----------
		xt_final = place_eq(MathTex(
			r"x(t) = x_0 + v_0\,t + \tfrac{1}{2}g t^2",
			substrings_to_isolate=[r"x(t)", r"=", r"x_0", r"+", r"v_0", r"t", r"\tfrac{1}{2}", r"g", r"t^2"],
			font_size=EQ_FONT
		))
		self.play(TransformMatchingTex(current_eq, xt_final), run_time=0.8)
		
		# Create descriptive text above the equation
		description = Tex(
			r"The classic kinematic equation for objects moving under gravity:",
			font_size=36
		).next_to(xt_final, UP, buff=0.8)
		
		# Create blue glow effect using multiple blurred copies
		glow_layers = VGroup()
		
		# Create multiple offset copies to simulate blur (tighter)
		blur_offsets = [
			[0, 0], [0.02, 0], [-0.02, 0], [0, 0.02], [0, -0.02],
			[0.02, 0.02], [-0.02, -0.02], [0.02, -0.02], [-0.02, 0.02],
			[0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04]
		]
		
		for offset in blur_offsets:
			glow_copy = xt_final.copy()
			glow_copy.set_color("#3399FF")  # Tad lighter blue
			glow_copy.set_opacity(0)
			glow_copy.shift(offset[0] * RIGHT + offset[1] * UP)
			glow_layers.add(glow_copy)
		
		# First fade in description and fade out step 7 elements
		self.play(
			FadeIn(description, shift=0.2 * UP),
			FadeOut(card_sum, shift=0.15 * RIGHT),
			FadeOut(caption),
			run_time=0.8,
			rate_func=smooth
		)
		
		# Wait a moment, then start the blue glow effect
		self.wait(0.3)
		
		# Add glow layers behind the text and fade them in
		self.add(glow_layers)
		
		# Remove and re-add the original text to ensure it's on top
		self.remove(xt_final)
		self.add(xt_final)
		
		self.play(
			glow_layers.animate.set_opacity(0.25),  # Slightly more blue
			run_time=0.8,
			rate_func=smooth
		)
		
		# Hold the glow briefly
		self.wait(0.5)
		
		# Fade out the glow
		self.play(
			glow_layers.animate.set_opacity(0),
			run_time=0.8,
			rate_func=smooth
		)
		self.remove(glow_layers)
		
		# Wait after the shine effect finishes
		self.wait(2.0)
		
		current_eq = xt_final

		# Clean finish
		self.wait(0.6)
		#self.play(VGroup(current_eq, caption).animate.shift(0.15 * UP), run_time=0.35)
		self.wait(0.7)
