from manim import *


class CdotNormalDerivation(Scene):
    def construct(self):
        # Title
        title = Text(
            "Deriving ΔCdot_normal",
            font_size=48,
        ).move_to(UP * 3.0)

        self.play(FadeIn(title))
        self.wait(0.6)

        # Starting equations: ΔCdot.x and ΔCdot.y
        cdot_x_eq = VGroup(
            MathTex(
                r"\Delta \mathrm{Cdot}.x = Jx \cdot (mA + mB + rA.y^{2} \cdot iA + rB.y^{2} \cdot iB)",
                font_size=36,
            ),
            MathTex(
                r"+ Jy \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=36,
            ),
        ).arrange(DOWN, buff=0.15)

        cdot_y_eq = VGroup(
            MathTex(
                r"\Delta \mathrm{Cdot}.y = Jx \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=36,
            ),
            MathTex(
                r"+ Jy \cdot (mA + mB + rA.x^{2} \cdot iA + rB.x^{2} \cdot iB)",
                font_size=36,
            ),
        ).arrange(DOWN, buff=0.15)

        starting_eqs = VGroup(cdot_x_eq, cdot_y_eq).arrange(DOWN, buff=0.5)
        starting_eqs.move_to(DOWN * 0.3)

        self.play(FadeIn(starting_eqs))
        self.wait(1.0)

        # Fade out and show the dot product definition
        self.play(FadeOut(starting_eqs))
        self.wait(0.3)

        # ΔCdot_normal definition
        normal_def = MathTex(
            r"\Delta \mathrm{Cdot}_{normal} = \Delta \mathrm{Cdot} \cdot n = \Delta \mathrm{Cdot}.x \cdot n.x + \Delta \mathrm{Cdot}.y \cdot n.y",
            font_size=40,
        )
        normal_def.move_to(UP * 1.5)

        self.play(FadeIn(normal_def))
        self.wait(0.8)

        # Expanded form with all four terms
        expanded_label = MathTex(
            r"\Delta \mathrm{Cdot}_{normal} =",
            font_size=36,
        )

        expanded_lines = VGroup(
            MathTex(
                r"n.x \cdot Jx \cdot (mA + mB + rA.y^{2} \cdot iA + rB.y^{2} \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ n.x \cdot Jy \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ n.y \cdot Jx \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ n.y \cdot Jy \cdot (mA + mB + rA.x^{2} \cdot iA + rB.x^{2} \cdot iB)",
                font_size=32,
            ),
        ).arrange(DOWN, buff=0.25)

        expanded_group = VGroup(expanded_label, expanded_lines).arrange(DOWN, buff=0.3)
        expanded_group.move_to(DOWN * 0.8)

        self.play(FadeIn(expanded_group))
        self.wait(1.0)

        # Fade out and show the J = λn constraint
        self.play(FadeOut(normal_def), FadeOut(expanded_group))
        self.wait(0.3)

        constraint_title = Text(
            "For contact constraints, J is along normal:",
            font_size=32,
        ).move_to(UP * 1.5)

        constraint_eqs = VGroup(
            MathTex(r"J = \lambda \cdot n", font_size=44),
            MathTex(r"Jx = \lambda \cdot n.x", font_size=40),
            MathTex(r"Jy = \lambda \cdot n.y", font_size=40),
        ).arrange(DOWN, buff=0.4)
        constraint_eqs.move_to(DOWN * 0.5)

        self.play(FadeIn(constraint_title))
        self.wait(0.4)
        self.play(FadeIn(constraint_eqs))
        self.wait(1.0)

        # Fade out and show substituted form
        self.play(FadeOut(constraint_title), FadeOut(constraint_eqs))
        self.wait(0.3)

        subst_title = Text(
            "Substituting Jx = λ·n.x and Jy = λ·n.y:",
            font_size=32,
        ).move_to(UP * 1.5)

        subst_label = MathTex(
            r"\Delta \mathrm{Cdot}_{normal} =",
            font_size=36,
        )

        subst_lines = VGroup(
            MathTex(
                r"\lambda \cdot n.x^{2} \cdot (mA + mB + rA.y^{2} \cdot iA + rB.y^{2} \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ \lambda \cdot n.x \cdot n.y \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ \lambda \cdot n.y \cdot n.x \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ \lambda \cdot n.y^{2} \cdot (mA + mB + rA.x^{2} \cdot iA + rB.x^{2} \cdot iB)",
                font_size=32,
            ),
        ).arrange(DOWN, buff=0.25)

        subst_group = VGroup(subst_label, subst_lines).arrange(DOWN, buff=0.3)
        subst_group.move_to(DOWN * 0.5)

        self.play(FadeIn(subst_title))
        self.wait(0.3)
        self.play(FadeIn(subst_group))
        self.wait(1.0)

        # Fade out and show factored form
        self.play(FadeOut(subst_title), FadeOut(subst_group))
        self.wait(0.3)

        factor_title = Text(
            "Factor out λ, combine middle terms:",
            font_size=32,
        ).move_to(UP * 1.5)

        factored_eq = VGroup(
            MathTex(
                r"\Delta \mathrm{Cdot}_{normal} = \lambda \cdot \Big( n.x^{2} \cdot (mA + mB + rA.y^{2} \cdot iA + rB.y^{2} \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ n.y^{2} \cdot (mA + mB + rA.x^{2} \cdot iA + rB.x^{2} \cdot iB)",
                font_size=32,
            ),
            MathTex(
                r"+ 2 \cdot n.x \cdot n.y \cdot (-rA.x \cdot rA.y \cdot iA - rB.x \cdot rB.y \cdot iB) \Big)",
                font_size=32,
            ),
        ).arrange(DOWN, buff=0.2)
        factored_eq.move_to(DOWN * 0.5)

        self.play(FadeIn(factor_title))
        self.wait(0.3)
        self.play(FadeIn(factored_eq))
        self.wait(1.0)

        # Fade out and show rearranged form
        self.play(FadeOut(factor_title), FadeOut(factored_eq))
        self.wait(0.3)

        rearrange_title = Text(
            "Rearranging by mass and inertia terms:",
            font_size=32,
        ).move_to(UP * 1.5)

        rearranged_eq = VGroup(
            MathTex(
                r"\Delta \mathrm{Cdot}_{normal} = \lambda \cdot \Big( (n.x^{2} + n.y^{2}) \cdot (mA + mB)",
                font_size=28,
            ),
            MathTex(
                r"+ iA \cdot (n.x^{2} \cdot rA.y^{2} + n.y^{2} \cdot rA.x^{2} - 2 \cdot n.x \cdot n.y \cdot rA.x \cdot rA.y)",
                font_size=28,
            ),
            MathTex(
                r"+ iB \cdot (n.x^{2} \cdot rB.y^{2} + n.y^{2} \cdot rB.x^{2} - 2 \cdot n.x \cdot n.y \cdot rB.x \cdot rB.y) \Big)",
                font_size=28,
            ),
        ).arrange(DOWN, buff=0.2)
        rearranged_eq.move_to(DOWN * 0.5)

        self.play(FadeIn(rearrange_title))
        self.wait(0.3)
        self.play(FadeIn(rearranged_eq))
        self.wait(1.0)

        # Fade out and show cross product identity
        self.play(FadeOut(rearrange_title), FadeOut(rearranged_eq))
        self.wait(0.3)

        identity_title = Text(
            "Since n is unit vector: n.x² + n.y² = 1",
            font_size=32,
        ).move_to(UP * 1.5)

        cross_def = MathTex(
            r"\text{2D cross product: } rA \times n = rA.x \cdot n.y - rA.y \cdot n.x",
            font_size=36,
        ).move_to(UP * 0.3)

        cross_squared = VGroup(
            MathTex(
                r"(rA \times n)^{2} = (rA.x \cdot n.y - rA.y \cdot n.x)^{2}",
                font_size=32,
            ),
            MathTex(
                r"= rA.x^{2} \cdot n.y^{2} - 2 \cdot rA.x \cdot rA.y \cdot n.x \cdot n.y + rA.y^{2} \cdot n.x^{2}",
                font_size=32,
            ),
            MathTex(
                r"= n.x^{2} \cdot rA.y^{2} + n.y^{2} \cdot rA.x^{2} - 2 \cdot n.x \cdot n.y \cdot rA.x \cdot rA.y",
                font_size=32,
            ),
        ).arrange(DOWN, buff=0.2)
        cross_squared.move_to(DOWN * 1.0)

        self.play(FadeIn(identity_title))
        self.wait(0.4)
        self.play(FadeIn(cross_def))
        self.wait(0.5)
        self.play(FadeIn(cross_squared))
        self.wait(1.0)

        match_note = Text(
            "This matches the terms in our equation!",
            font_size=32,
            color=YELLOW,
        ).move_to(DOWN * 2.8)

        self.play(FadeIn(match_note))
        self.wait(0.8)

        # Fade out and show final result
        self.play(FadeOut(identity_title), FadeOut(cross_def), FadeOut(cross_squared), FadeOut(match_note))
        self.wait(0.3)

        final_title = Text(
            "Final Result",
            font_size=40,
            color=GREEN,
        ).move_to(UP * 1.5)

        final_eq = MathTex(
            r"\Delta \mathrm{Cdot}_{normal} = \lambda \cdot \Big( mA + mB + iA \cdot (rA \times n)^{2} + iB \cdot (rB \times n)^{2} \Big)",
            font_size=40,
        )
        final_eq.move_to(DOWN * 0.3)

        # Create a box around the final equation
        box = SurroundingRectangle(final_eq, color=GREEN, buff=0.3)

        self.play(FadeIn(final_title))
        self.wait(0.3)
        self.play(FadeIn(final_eq))
        self.wait(0.3)
        self.play(Create(box))
        self.wait(2.0)

