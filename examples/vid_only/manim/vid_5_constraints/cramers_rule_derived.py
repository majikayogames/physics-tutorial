from manim import *


class CramersRuleDerived(Scene):
    def construct(self):
        # Title
        title = Text(
            "Derivation via Substitution",
            font_size=48,
        ).move_to(UP * 3.2)
        
        self.play(FadeIn(title))
        self.wait(0.6)

        # Step 1: The System of Equations
        subtitle1 = Text(
            "System of Equations:",
            font_size=36,
        ).move_to(UP * 2.0)
        
        eqs1 = VGroup(
            MathTex(r"K_{00} J_x + K_{01} J_y = -\mathrm{Cdot}_x", font_size=48),
            MathTex(r"K_{10} J_x + K_{11} J_y = -\mathrm{Cdot}_y", font_size=48),
        ).arrange(DOWN, buff=0.4)
        
        group1 = VGroup(subtitle1, eqs1).arrange(DOWN, buff=0.6)
        group1.move_to(ORIGIN)

        self.play(FadeIn(subtitle1))
        for eq in eqs1:
            self.play(Write(eq))
            self.wait(0.3)
        self.wait(1.5)
        self.play(FadeOut(group1))


        # Step 2: Solve first equation for Jx
        subtitle2 = Text(
            "Solve first equation for Jx:",
            font_size=36,
        ).move_to(UP * 2.0)

        eq2 = MathTex(
            r"J_x = \frac{-\mathrm{Cdot}_x - K_{01} J_y}{K_{00}}",
            font_size=48
        )
        
        group2 = VGroup(subtitle2, eq2).arrange(DOWN, buff=0.6)
        group2.move_to(ORIGIN)

        self.play(FadeIn(subtitle2))
        self.play(Write(eq2))
        self.wait(1.5)
        self.play(FadeOut(group2))


        # Step 3: Substitute into second equation
        subtitle3 = Text(
            "Substitute into second equation:",
            font_size=36,
        ).move_to(UP * 2.5)

        # Large substitution equation
        eq3 = MathTex(
            r"K_{10} \left( \frac{-\mathrm{Cdot}_x - K_{01} J_y}{K_{00}} \right) + K_{11} J_y = -\mathrm{Cdot}_y",
            font_size=42
        )
        
        group3 = VGroup(subtitle3, eq3).arrange(DOWN, buff=0.6)
        group3.move_to(ORIGIN)

        self.play(FadeIn(subtitle3))
        self.play(Write(eq3))
        self.wait(1.5)
        self.play(FadeOut(group3))


        # Step 4: Multiply by K00 and rearrange
        subtitle4 = Text(
            "Multiply by K00 and rearrange:",
            font_size=36,
        ).move_to(UP * 2.5)

        eqs4 = VGroup(
            MathTex(
                r"K_{10} (-\mathrm{Cdot}_x - K_{01} J_y) + K_{11} K_{00} J_y = -\mathrm{Cdot}_y K_{00}",
                font_size=40
            ),
            MathTex(
                r"-K_{10} \mathrm{Cdot}_x - K_{10} K_{01} J_y + K_{11} K_{00} J_y = -\mathrm{Cdot}_y K_{00}",
                font_size=40
            ),
            MathTex(
                r"J_y (K_{00} K_{11} - K_{01} K_{10}) = -\mathrm{Cdot}_y K_{00} + \mathrm{Cdot}_x K_{10}",
                font_size=40
            )
        ).arrange(DOWN, buff=0.5)

        group4 = VGroup(subtitle4, eqs4).arrange(DOWN, buff=0.6)
        group4.move_to(ORIGIN)

        self.play(FadeIn(subtitle4))
        for eq in eqs4:
            self.play(Write(eq))
            self.wait(0.8)
        self.wait(1.5)
        self.play(FadeOut(group4))


        # Step 5: Solve for Jy
        subtitle5 = Text(
            "Solve for Jy:",
            font_size=36,
        ).move_to(UP * 2.0)

        eq5 = MathTex(
            r"J_y = \frac{-\mathrm{Cdot}_y K_{00} + \mathrm{Cdot}_x K_{10}}{K_{00} K_{11} - K_{01} K_{10}}",
            font_size=48
        )
        
        group5 = VGroup(subtitle5, eq5).arrange(DOWN, buff=0.6)
        group5.move_to(ORIGIN)

        self.play(FadeIn(subtitle5))
        self.play(Write(eq5))
        self.wait(1.5)
        self.play(FadeOut(group5))


        # Step 6: Back-substitute for Jx
        subtitle6 = Text(
            "Back-substitute to find Jx:",
            font_size=36,
        ).move_to(UP * 2.0)

        eq6 = MathTex(
            r"J_x = \frac{-\mathrm{Cdot}_x K_{11} + \mathrm{Cdot}_y K_{01}}{K_{00} K_{11} - K_{01} K_{10}}",
            font_size=48
        )

        group6 = VGroup(subtitle6, eq6).arrange(DOWN, buff=0.6)
        group6.move_to(ORIGIN)

        self.play(FadeIn(subtitle6))
        self.play(Write(eq6))
        self.wait(1.5)
        self.play(FadeOut(group6))


        # Step 7: Final Result & Determinant Note
        subtitle7 = Text(
            "Final Result (Cramer's Rule equivalent):",
            font_size=36,
        ).move_to(UP * 3.0)

        eqs7 = VGroup(
            MathTex(
                r"J_x = \frac{-\mathrm{Cdot}_x K_{11} + \mathrm{Cdot}_y K_{01}}{\det(K)}",
                font_size=44
            ),
            MathTex(
                r"J_y = \frac{-\mathrm{Cdot}_y K_{00} + \mathrm{Cdot}_x K_{10}}{\det(K)}",
                font_size=44
            ),
            Text(
                "where det(K) = K[0][0] * K[1][1] - K[0][1] * K[1][0]",
                font_size=24,
                slant=ITALIC
            )
        ).arrange(DOWN, buff=0.5)

        group7 = VGroup(subtitle7, eqs7).arrange(DOWN, buff=0.6)
        group7.move_to(ORIGIN)

        self.play(FadeIn(subtitle7))
        for item in eqs7:
            self.play(Write(item))
            self.wait(0.5)

        self.wait(4)

