Nazario (niz, naz) thought process
==================================

Kind of stream of conscious.

**product**

Just read the requirements. Sounds similar to another company that was used a lot before the pandemic when people worked in office. The company made or gathered meals for office employees.

A user could set up their meal preferences ahead of time in case they forgot to place an order on time. preferences included allergens, types of protein, cuisine, etc.

**technical**

Looking through the code base it does look like redwoodJS structure.
I have not looked at every file yet but I will initiate a git repo and then run npm install just to get it running and see what I have to work wth.

I see that there is also a docker file that I will explore shortly.

back of my mind is the product stuff I mentioned above. 


---
Just got the database up and running and looking over the schema.

I see that it has data. Looks like the FE is 100% open to me.

I will eat some lunch think about a users workflow MVP and come back to this. I may write stuff down on paper/white board. I will try to document stuff in `systemDesign` directory.

---

Ok I lied I looked at the schema just a bit
<img alt="schema" src="./2-schema.png" />

"diet_orders" - is like a "menu" of diets that a patient might have. Like for high blood-pressure, cholesterol, etc, etc. I'll ask my wife for realistic values here just make it more realistic.

"patient_diet_orders" - is the actual diet "prescription" for a given patient

"recipies" - holds the individual recipies. These will need to be made available (or not) to the patient so long it fits within the patients "prescription"

I am getting hungry, so I am going to come back to the last 2 tables.

0 - 1000 : liquid
1001 - 1500 : bland
1501 - 2000 : normal

---

I just got back from walking the dogs.

My wife and I chatted about this some more. She was a doctor back in the old country and here she manages nurses.
She has a lot of cool ideas about what and how meals should be made but I am having to focus her on calories (as a stand-in for other dietary restrictions).

This is my quick check in. I am about to decide how I want to proceed in terms of user flow and API. I am going to try to stick to the schema as it is and only make changes if absolutely necessary. Any "extra" changes will be documented along with a reason
but not implemented, most likely for future growth.

Please sit tight